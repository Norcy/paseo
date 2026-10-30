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
    const ignoredChecks = new Set((application.$["tools:ignore"] ?? "").split(",").filter(Boolean));
    if (enabled) {
      application.$["android:debuggable"] = "true";
      ignoredChecks.add("HardcodedDebugMode");
      modConfig.modResults.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    } else {
      delete application.$["android:debuggable"];
      ignoredChecks.delete("HardcodedDebugMode");
    }
    if (ignoredChecks.size > 0) {
      application.$["tools:ignore"] = [...ignoredChecks].join(",");
    } else {
      delete application.$["tools:ignore"];
    }
    return modConfig;
  });
}

module.exports = withAndroidDebuggable;
