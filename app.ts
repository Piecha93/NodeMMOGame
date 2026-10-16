import { createApplication } from "./server/Application";

export { createApplication } from "./server/Application";

if (require.main === module) {
    const application = createApplication();
    let stopping = false;
    const shutdown = () => {
        if (stopping) return;
        stopping = true;
        void application.stop().catch((error: unknown) => {
            console.error("Unable to stop the application", error);
            process.exitCode = 1;
        });
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    void application
        .start()
        .then((address) => {
            console.log(`Node game server started at http://${address.address}:${address.port}`);
        })
        .catch((error: unknown) => {
            console.error("Unable to start the application", error);
            process.exitCode = 1;
        });
}
