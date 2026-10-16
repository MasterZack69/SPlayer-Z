import "./utils/appIdentity";
import { assertSupportedPlatform } from "@shared/utils/platform";
import { initApp } from "./core";

assertSupportedPlatform();
initApp();
