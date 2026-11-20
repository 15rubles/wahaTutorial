package app.muster.gamedata.model;

import java.util.Optional;

/** One model profile. Values are kept as printed ("6\"", "3+") so nothing is lost. */
public record StatProfile(
        String name, String m, String t, String sv, Optional<String> invuln, String w, String ld, String oc) {}
