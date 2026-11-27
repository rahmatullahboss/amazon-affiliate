import { createRequestHandler } from "react-router";
import { createImmutableBuildHandler } from "../server/utils/immutable-build-handler";

// Initialize the framework only when rendering a document. Each request keeps
// its independent request/context; only the immutable production build is reused.
const loadServerBuild = () => import("virtual:react-router/server-build");
export const renderDocument = import.meta.env.DEV
  ? createRequestHandler(loadServerBuild, import.meta.env.MODE)
  : createImmutableBuildHandler(loadServerBuild, build => createRequestHandler(build, import.meta.env.MODE));
