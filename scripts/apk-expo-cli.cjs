// React Native forces --reset-cache for every release bundle. Local dogfood builds
// still regenerate the bundle, but retain Metro's per-module transformation cache.
process.argv = process.argv.filter((arg) => arg !== "--reset-cache");
require(require.resolve("@expo/cli", { paths: [require.resolve("expo/package.json")] }));
