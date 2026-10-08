import type { Dict } from "./i18n";

export const deceasedLabels = (t: Dict) => ({
  markDeceased: t.markDeceased, dateOfDeath: t.dateOfDeath, optional: t.optional, newHead: t.newHead, chooseNewHead: t.chooseNewHead,
  noOtherMember: t.noOtherMember, mustChooseHead: t.mustChooseHead, dateInFuture: t.dateInFuture, dateRequired: t.dateRequired, notFound: t.noResults, cancel: t.cancel, close: t.close,
});

export const moveLabels = (t: Dict) => ({
  markMovedOut: t.markMovedOut, familyMovedOutBtn: t.familyMovedOutBtn, dateMoved: t.dateMoved, newPlace: t.newPlace, remarkLabel: t.remarkLabel,
  optional: t.optional, newHead: t.newHead, chooseNewHead: t.chooseNewHead, noOtherMember: t.noOtherMember, familyMoveAllMembers: t.familyMoveAllMembers,
  mustChooseHead: t.mustChooseHead, dateInFuture: t.dateInFuture, dateRequired: t.dateRequired, notFound: t.noResults, cancel: t.cancel, close: t.close,
});
