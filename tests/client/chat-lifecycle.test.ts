import assert from "node:assert/strict";
import test from "node:test";
import { ChatHtmlHandler } from "../../client/graphic/HtmlHandlers/ChatHtmlHandler";

test("chat: first Enter opens the input, the next submits and dispose removes listeners", () => {
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    const globals = ["HTMLInputElement", "HTMLFormElement", "HTMLDivElement"] as const;
    const originals = globals.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
    const page = new EventTarget() as EventTarget & { activeElement: unknown; getElementById(id: string): unknown };
    class Element extends EventTarget {
        value = "";
        style: Record<string, string> = {};
        focus(): void {
            page.activeElement = this;
        }
        blur(): void {
            page.activeElement = null;
        }
    }
    const input = new Element();
    const form = new Element();
    const messages = new Element();
    page.activeElement = null;
    page.getElementById = (id) =>
        ({ "chat-input": input, "chat-form": form, "chat-msgs": messages })[id as "chat-input"];
    Object.defineProperty(globalThis, "document", { value: page, configurable: true });
    for (const name of globals) Object.defineProperty(globalThis, name, { value: Element, configurable: true });
    const enter = (target?: unknown) => {
        const event = new Event("keydown", { cancelable: true });
        Object.defineProperty(event, "key", { value: "Enter" });
        if (target) Object.defineProperty(event, "target", { value: target });
        page.dispatchEvent(event);
        return event;
    };
    let handler: ChatHtmlHandler | undefined;
    try {
        handler = ChatHtmlHandler.Instance;
        const submitted: string[] = [];
        handler.setSubmitCallback((text) => submitted.push(text));
        assert.equal(
            enter({ closest: () => ({}) }).defaultPrevented,
            false,
            "Enter on a HUD button must retain its native activation",
        );
        assert.equal(page.activeElement, null);
        assert.equal(enter().defaultPrevented, true);
        assert.equal(page.activeElement, input);
        input.value = "regression";
        assert.equal(enter().defaultPrevented, false);
        form.dispatchEvent(new Event("submit", { cancelable: true }));
        assert.deepEqual(submitted, ["regression"]);
        assert.equal(input.value, "");
        assert.equal(page.activeElement, null);
        handler.dispose();
        assert.equal(enter().defaultPrevented, false);
        assert.equal(page.activeElement, null);
        assert.notEqual(ChatHtmlHandler.Instance, handler);
    } finally {
        ChatHtmlHandler.Instance.dispose();
        if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
        else Reflect.deleteProperty(globalThis, "document");
        globals.forEach((name, index) => {
            const original = originals[index];
            if (original) Object.defineProperty(globalThis, name, original);
            else Reflect.deleteProperty(globalThis, name);
        });
    }
});
