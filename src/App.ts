import { Log } from "@ubccpsc310/project-support";
import Server from "./rest/Server";

Log.info("App - starting");
(async (): Promise<void> => {
	const port = 1220;
	const server = new Server(port);
	await server.start();
})();
