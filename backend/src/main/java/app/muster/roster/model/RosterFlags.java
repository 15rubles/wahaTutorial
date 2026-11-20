package app.muster.roster.model;

/** Show/hide options of a roster (DESIGN.md 7.2 configuration panel). */
public record RosterFlags(boolean legends, boolean unalignedForces, boolean unalignedFortifications) {

    public static final RosterFlags DEFAULT = new RosterFlags(false, false, false);
}
