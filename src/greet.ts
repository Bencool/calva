export function activationGreetings(chan) {
    chan.appendLine("Did you know? There is Documentation: https://calva.readthedocs.io/");
    chan.appendLine("NOTE: Calva bundles the clj-kondo extension for your linting needs. Please see: https://calva.readthedocs.io/en/latest/linting.html");
    chan.appendLine("You are welcome to join the #calva-dev channel of the Clojurians Slack: https://clojurians.slack.com/messages/calva-dev/");
    chan.appendLine("Please file any feature requests or bug reports here: https://github.com/BetterThanTomorrow/calva/issues");
    chan.appendLine("If you like Calva, please consider becoming a sponsor:");
    chan.appendLine("  https://github.com/sponsors/PEZ ❤️");
    chan.appendLine("Happy Clojure(script) coding!");
    chan.appendLine("--");
}