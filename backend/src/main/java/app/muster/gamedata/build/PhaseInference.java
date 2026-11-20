package app.muster.gamedata.build;

import app.muster.gamedata.model.Phase;
import app.muster.gamedata.model.PhaseTags;
import app.muster.gamedata.model.Timing;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Infers phases and timing from rules text by looking for phrases like "your Shooting phase",
 * "the Fight phase", "your opponent's Movement phase" or "start of the battle". The result is
 * always marked {@code inferred = true} so an admin can confirm it. Returns empty when the text has
 * no recognizable phrase: the item then shows up in the review list with no tags.
 */
public final class PhaseInference {

    private static final Pattern PHASE = Pattern.compile(
            "\\b(your opponent'?s|opponent'?s|your|the|each|any|that|either player'?s)\\s+"
                    + "(command|movement|shooting|charge|fight)\\s+phases?\\b");
    private static final Pattern ANY_PHASE = Pattern.compile("\\b(any|each|every)\\s+phase\\b");
    private static final Pattern OPPONENT_TURN = Pattern.compile("\\b(your )?opponent'?s turn\\b");
    private static final Pattern YOUR_TURN = Pattern.compile("\\byour turn\\b");
    private static final Pattern PRE_GAME = Pattern.compile(
            "\\b(before the battle|start of the battle|declare battle formations|deploy(ment|ing)? (step|phase)"
                    + "|during deployment|when you muster|when mustering|pre-?game)\\b");

    private PhaseInference() {}

    public static Optional<PhaseTags> infer(String text) {
        if (text == null || text.isBlank()) return Optional.empty();
        String t = text.toLowerCase(Locale.ROOT).replace('’', '\'');

        Set<Phase> phases = EnumSet.noneOf(Phase.class);
        boolean mine = false;
        boolean theirs = false;
        boolean either = false;

        Matcher m = PHASE.matcher(t);
        while (m.find()) {
            phases.add(Phase.valueOf(m.group(2).toUpperCase(Locale.ROOT)));
            String who = m.group(1);
            if (who.startsWith("your opponent") || who.startsWith("opponent")) theirs = true;
            else if (who.equals("your")) mine = true;
            else either = true;
        }
        if (ANY_PHASE.matcher(t).find()) phases.add(Phase.ANY);
        if (OPPONENT_TURN.matcher(t).find()) theirs = true;
        if (YOUR_TURN.matcher(t).find()) mine = true;

        boolean preGame = PRE_GAME.matcher(t).find();
        if (phases.isEmpty() && preGame) {
            return Optional.of(new PhaseTags(List.of(Phase.ANY), Timing.PRE_GAME, true, false));
        }
        if (phases.isEmpty() && !mine && !theirs) return Optional.empty();
        if (phases.isEmpty()) phases.add(Phase.ANY);
        if (phases.size() > 1) phases.remove(Phase.ANY);

        Timing timing;
        if ((mine && theirs) || (either && !mine && !theirs)) timing = Timing.EITHER_TURN;
        else if (theirs) timing = Timing.OPPONENT_TURN;
        else if (mine) timing = Timing.YOUR_TURN;
        else timing = Timing.EITHER_TURN;
        return Optional.of(new PhaseTags(List.copyOf(phases), timing, true, false));
    }

    /**
     * Structured tags from a source with phase and turn columns (for example a stratagem export).
     * Unknown values give empty results instead of guesses.
     */
    public static Optional<PhaseTags> fromColumns(String phaseColumn, String turnColumn) {
        Set<Phase> phases = EnumSet.noneOf(Phase.class);
        String p = phaseColumn == null ? "" : phaseColumn.toLowerCase(Locale.ROOT);
        for (Phase phase : Phase.values()) {
            if (phase != Phase.ANY && p.contains(phase.name().toLowerCase(Locale.ROOT))) phases.add(phase);
        }
        if (p.contains("any")) phases.add(Phase.ANY);
        boolean preGame = p.contains("deploy") || p.contains("before") || p.contains("start of the battle");
        String turn = turnColumn == null ? "" : turnColumn.toLowerCase(Locale.ROOT).replace('’', '\'');
        Timing timing;
        if (turn.contains("either") || turn.contains("any") || turn.contains("both")) timing = Timing.EITHER_TURN;
        else if (turn.contains("opponent")) timing = Timing.OPPONENT_TURN;
        else if (turn.contains("your")) timing = Timing.YOUR_TURN;
        else timing = null;
        if (preGame && phases.isEmpty()) return Optional.of(new PhaseTags(List.of(Phase.ANY), Timing.PRE_GAME, false, false));
        if (phases.isEmpty() || timing == null) return Optional.empty();
        return Optional.of(new PhaseTags(List.copyOf(phases), timing, false, false));
    }
}
