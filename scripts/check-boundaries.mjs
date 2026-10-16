import path from "node:path";
import { fileURLToPath } from "node:url";
import { API } from "typescript/unstable/sync";
import { SyntaxKind } from "typescript/unstable/ast";

const domNames = new Set([
    "window",
    "document",
    "navigator",
    "localStorage",
    "sessionStorage",
    "Window",
    "Document",
    "HTMLElement",
    "HTMLCanvasElement",
    "CanvasRenderingContext2D",
    "OffscreenCanvas",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "WebSocket",
    "XMLHttpRequest",
    "Image",
    "Audio",
]);
const portablePackages = new Set(["detect-collisions"]);
const slash = (value) => value.replaceAll("\\", "/");

function dependencyProblem(file, specifier) {
    const target = specifier.startsWith(".")
        ? slash(path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)))
        : specifier;
    if (file.startsWith("client/") && target.startsWith("server/")) return "client cannot import server code";
    if (file.startsWith("server/") && target.startsWith("client/")) return "server cannot import browser code";
    if (!file.startsWith("shared/")) return null;
    if (!specifier.startsWith(".")) {
        if (!portablePackages.has(specifier)) return "shared code cannot import platform or service packages";
    } else if (!target.startsWith("shared/")) return "shared code must remain independent of client and server";
    if (file.startsWith("shared/protocol/") && !target.startsWith("shared/protocol/")) {
        return "protocol must depend only on its own versioned schema and codecs";
    }
    if (file.startsWith("shared/core/") && /^shared\/(protocol|replication|serialize|net)\//.test(target + "/")) {
        return "simulation core cannot depend on transport, replication or serialization adapters";
    }
    return null;
}

/** Uses the pinned TypeScript 7 syntax tree and symbol declarations, not text matching. */
export function checkProject(root = process.cwd()) {
    const api = new API({ cwd: root });
    const config = path.resolve(root, "tsconfig.json");
    const violations = [];
    let snapshot;
    try {
        snapshot = api.updateSnapshot({ openProjects: [config] });
        const project = snapshot.getProject(config);
        if (!project) throw new Error(`Cannot open architecture project: ${config}`);
        for (const name of project.program.getSourceFileNames()) {
            const relative = slash(path.relative(root, name));
            if (!/^(client|server|shared)\//.test(relative) || relative.endsWith(".d.ts")) continue;
            const source = project.program.getSourceFile(name);
            if (!source) continue;
            const report = (node, message) => {
                const position = source.getLineAndCharacterOfPosition(node.getStart(source));
                violations.push({ file: relative, line: position.line + 1, message });
            };
            const dependency = (node) => {
                if (node?.kind !== SyntaxKind.StringLiteral) return;
                const problem = dependencyProblem(relative, node.text);
                if (problem) report(node, `${problem}: ${node.text}`);
            };
            const visit = (node) => {
                if (node.kind === SyntaxKind.ImportDeclaration || node.kind === SyntaxKind.ExportDeclaration)
                    dependency(node.moduleSpecifier);
                if (node.kind === SyntaxKind.ImportEqualsDeclaration) dependency(node.moduleReference?.expression);
                if (node.kind === SyntaxKind.ImportType) dependency(node.argument?.literal);
                if (
                    node.kind === SyntaxKind.CallExpression &&
                    (node.expression.kind === SyntaxKind.ImportKeyword || node.expression.getText(source) === "require")
                ) {
                    const symbol =
                        node.expression.kind === SyntaxKind.Identifier
                            ? project.checker.getSymbolAtLocation(node.expression)
                            : undefined;
                    const localRequire = symbol?.declarations.some(
                        (declaration) => !slash(declaration.path).includes("/node_modules/"),
                    );
                    if (!localRequire) {
                        if (relative.startsWith("shared/") && node.arguments[0]?.kind !== SyntaxKind.StringLiteral) {
                            report(node, "shared dynamic dependencies must use a static module specifier");
                        } else dependency(node.arguments[0]);
                    }
                }
                if (
                    /^shared\/(core|protocol)\//.test(relative) &&
                    node.kind === SyntaxKind.Identifier &&
                    domNames.has(node.text)
                ) {
                    const symbol = project.checker.getSymbolAtLocation(node);
                    if (
                        symbol?.declarations.some((declaration) =>
                            /\/lib\.dom(?:\.iterable)?\.d\.ts$/.test(slash(declaration.path)),
                        )
                    ) {
                        report(node, `portable simulation/protocol cannot reference DOM global '${node.text}'`);
                    }
                }
                if (
                    /^shared\/(core|protocol)\//.test(relative) &&
                    node.kind === SyntaxKind.ElementAccessExpression &&
                    node.expression.kind === SyntaxKind.Identifier &&
                    node.expression.text === "globalThis" &&
                    node.argumentExpression?.kind === SyntaxKind.StringLiteral &&
                    domNames.has(node.argumentExpression.text)
                ) {
                    const symbol = project.checker.getSymbolAtLocation(node.expression);
                    if (
                        !symbol?.declarations.some((declaration) => !slash(declaration.path).includes("/node_modules/"))
                    ) {
                        report(
                            node,
                            `portable simulation/protocol cannot reference DOM global '${node.argumentExpression.text}'`,
                        );
                    }
                }
                node.forEachChild(visit);
            };
            visit(source);
        }
        return violations;
    } finally {
        snapshot?.dispose();
        api.close();
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const violations = checkProject();
    for (const violation of violations) console.error(`${violation.file}:${violation.line}: ${violation.message}`);
    if (violations.length) process.exitCode = 1;
    else console.log("Architecture boundaries passed");
}
