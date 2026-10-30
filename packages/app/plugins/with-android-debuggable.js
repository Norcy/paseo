const { withAndroidManifest } = require("expo/config-plugins");

function withAndroidDebuggable(config, enabled) {
  return withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error(
        "Could not configure Android debugging without an application manifest entry",
      );
    }

    // Keep the release build type so the bundled JS runs without Metro.
    application.$["android:debuggable"] = String(enabled);
    return modConfig;
  });
}

module.exports = withAndroidDebuggable;
