import { app } from "electron";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

// Set the profile before any store, logger, or persistent session is initialized.
app.setName("SPlayer-Z");
const userData = join(app.getPath("appData"), "SPlayer-Z");
mkdirSync(userData, { recursive: true });
app.setPath("userData", userData);
app.setPath("sessionData", userData);
app.setDesktopName("io.github.MasterZack69.SPlayerZ.desktop");
