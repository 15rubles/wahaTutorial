package app.muster.gamedata.build;

import static org.assertj.core.api.Assertions.assertThat;

import app.muster.gamedata.model.Phase;
import app.muster.gamedata.model.PhaseTags;
import app.muster.gamedata.model.Timing;
import java.util.List;
import org.junit.jupiter.api.Test;

class PhaseInferenceTest {

    private static PhaseTags infer(String text) {
        return PhaseInference.infer(text).orElseThrow();
    }

    @Test
    void yourPhase() {
        PhaseTags t = infer("Each time a unit is selected to shoot in your Shooting phase, it may re-roll.");
        assertThat(t.phases()).containsExactly(Phase.SHOOTING);
        assertThat(t.timing()).isEqualTo(Timing.YOUR_TURN);
        assertThat(t.inferred()).isTrue();
        assertThat(t.confirmed()).isFalse();
    }

    @Test
    void opponentsPhase() {
        PhaseTags t = infer("At the end of your opponent's Movement phase, this unit can arrive.");
        assertThat(t.phases()).containsExactly(Phase.MOVEMENT);
        assertThat(t.timing()).isEqualTo(Timing.OPPONENT_TURN);
    }

    @Test
    void curlyApostropheAndThePhaseMeansEither() {
        assertThat(infer("In your opponent’s Charge phase.").timing()).isEqualTo(Timing.OPPONENT_TURN);
        PhaseTags fight = infer("Use this in the Fight phase.");
        assertThat(fight.phases()).containsExactly(Phase.FIGHT);
        assertThat(fight.timing()).isEqualTo(Timing.EITHER_TURN);
    }

    @Test
    void bothTurnsBecomeEither() {
        PhaseTags t = infer("In your Command phase or your opponent's Shooting phase.");
        assertThat(t.phases()).containsExactlyInAnyOrder(Phase.COMMAND, Phase.SHOOTING);
        assertThat(t.timing()).isEqualTo(Timing.EITHER_TURN);
    }

    @Test
    void preGame() {
        PhaseTags t = infer("During the Declare Battle Formations step, set this unit up in reserve.");
        assertThat(t.timing()).isEqualTo(Timing.PRE_GAME);
        assertThat(t.phases()).containsExactly(Phase.ANY);
    }

    @Test
    void anyPhase() {
        assertThat(infer("Once per battle, in any phase, you can do this.").phases()).containsExactly(Phase.ANY);
    }

    @Test
    void nothingRecognizableGivesEmpty() {
        assertThat(PhaseInference.infer("This model has a big hat.")).isEmpty();
        assertThat(PhaseInference.infer("")).isEmpty();
        assertThat(PhaseInference.infer(null)).isEmpty();
    }

    @Test
    void structuredColumnsAreNotInferred() {
        PhaseTags t = PhaseInference.fromColumns("Shooting or Fight phase", "Either player's turn").orElseThrow();
        assertThat(t.phases()).containsExactlyInAnyOrder(Phase.SHOOTING, Phase.FIGHT);
        assertThat(t.timing()).isEqualTo(Timing.EITHER_TURN);
        assertThat(t.inferred()).isFalse();
        assertThat(PhaseInference.fromColumns("Command phase", "Your turn").orElseThrow().timing()).isEqualTo(Timing.YOUR_TURN);
        assertThat(PhaseInference.fromColumns("Movement phase", "Opponent's turn").orElseThrow().timing()).isEqualTo(Timing.OPPONENT_TURN);
        assertThat(PhaseInference.fromColumns("", "")).isEmpty();
        assertThat(PhaseInference.fromColumns("Fight phase", "")).isEmpty();
        assertThat(PhaseInference.fromColumns("Before the battle", "").orElseThrow().timing()).isEqualTo(Timing.PRE_GAME);
        assertThat(List.of(Phase.values())).contains(Phase.ANY);
    }
}
