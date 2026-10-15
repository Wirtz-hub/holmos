// Words visitors see on public pages and in booking emails, in Danish and English.

const da = {
  locale: "da-DK",
  required: "Udfyld venligst dette felt",
  mustTick: "Sæt venligst flueben her",
  tooLong: "Teksten er for lang",
  badEmail: "Tjek e-mailadressen",
  badPhone: "Tjek telefonnummeret",
  yes: "Ja",
  sending: "Sender…",
  formError: "Noget gik galt. Prøv igen om et øjeblik.",
  formClosed: "Formularen tager ikke imod svar lige nu.",
  tooMany: "Du har sendt mange svar på kort tid. Prøv igen om lidt.",
  formUnavailable: "Formularen er ikke tilgængelig.",
  // Booking
  minutes: (n: number) => `${n} min.`,
  chooseTime: "Vælg et tidspunkt",
  noTimes: "Ingen ledige tider denne dag.",
  noTimesWeek: "Ingen ledige tider i denne uge.",
  previousWeek: "Forrige uge",
  nextWeek: "Næste uge",
  timesShownIn: (tz: string) => `Tider vises i ${tz}`,
  loadingTimes: "Henter ledige tider…",
  yourDetails: "Dine oplysninger",
  name: "Navn",
  email: "E-mail",
  phone: "Telefon",
  phoneOptional: "Telefon (valgfrit)",
  note: "Er der noget, vi skal vide før mødet? (valgfrit)",
  back: "Tilbage",
  confirm: "Bekræft booking",
  booking: "Booker…",
  booked: "Du er booket!",
  bookedText: "Vi har sendt en bekræftelse til din e-mail.",
  bookedNoEmail: "Tiden er reserveret til dig. Skriv den gerne ind i din kalender.",
  joinMeeting: "Mødelink",
  slotTaken: "Tiden er lige blevet taget. Vælg en anden.",
  calendarUnavailable: "Denne kalender er ikke tilgængelig.",
  // Cancelling
  cancelTitle: "Aflys din booking",
  cancelButton: "Aflys booking",
  cancelling: "Aflyser…",
  cancelled: "Din booking er aflyst.",
  cancelledText: "Du er velkommen til at booke en ny tid.",
  bookAgain: "Book en ny tid",
  cannotCancel: "Bookingen er allerede aflyst eller overstået.",
  // Locations
  location: {
    google_meet: "Videomøde (Google Meet)",
    phone: "Telefonmøde – vi ringer til dig",
    in_person: "Fysisk møde",
    custom: "",
  } as Record<string, string>,
  // Emails
  emailConfirmSubject: (what: string) => `Bekræftet: ${what}`,
  emailConfirmIntro: (name: string) => `Hej ${name}, tak for din booking. Her er detaljerne:`,
  emailReminderSubject: (what: string) => `Påmindelse: ${what}`,
  emailReminderIntro: (name: string) => `Hej ${name}, en påmindelse om dit kommende møde:`,
  emailCancelSubject: (what: string) => `Aflyst: ${what}`,
  emailCancelIntro: (name: string) => `Hej ${name}, din booking er aflyst:`,
  emailWhen: "Hvornår",
  emailWhere: "Hvor",
  emailCancelLink: "Kan du ikke alligevel? Aflys her",
  emailBookAgain: "Book en ny tid",
};

export type PublicText = typeof da;

const en: PublicText = {
  locale: "en-GB",
  required: "Please fill this in",
  mustTick: "Please tick this box",
  tooLong: "That's too long",
  badEmail: "Check the email address",
  badPhone: "Check the phone number",
  yes: "Yes",
  sending: "Sending…",
  formError: "Something went wrong. Please try again in a moment.",
  formClosed: "This form isn't taking answers right now.",
  tooMany: "You've sent a lot of answers in a short time. Please try again shortly.",
  formUnavailable: "This form isn't available.",
  minutes: (n) => `${n} min`,
  chooseTime: "Pick a time",
  noTimes: "No free times on this day.",
  noTimesWeek: "No free times this week.",
  previousWeek: "Previous week",
  nextWeek: "Next week",
  timesShownIn: (tz) => `Times shown in ${tz}`,
  loadingTimes: "Finding free times…",
  yourDetails: "Your details",
  name: "Name",
  email: "Email",
  phone: "Phone",
  phoneOptional: "Phone (optional)",
  note: "Anything we should know before the meeting? (optional)",
  back: "Back",
  confirm: "Confirm booking",
  booking: "Booking…",
  booked: "You're booked!",
  bookedText: "We've sent a confirmation to your email.",
  bookedNoEmail: "The time is reserved for you. Do add it to your calendar.",
  joinMeeting: "Meeting link",
  slotTaken: "Someone just took that time. Please pick another.",
  calendarUnavailable: "This calendar isn't available.",
  cancelTitle: "Cancel your booking",
  cancelButton: "Cancel booking",
  cancelling: "Cancelling…",
  cancelled: "Your booking is cancelled.",
  cancelledText: "You're welcome to book a new time.",
  bookAgain: "Book a new time",
  cannotCancel: "This booking is already cancelled or has passed.",
  location: {
    google_meet: "Video call (Google Meet)",
    phone: "Phone call – we'll call you",
    in_person: "In person",
    custom: "",
  },
  emailConfirmSubject: (what) => `Confirmed: ${what}`,
  emailConfirmIntro: (name) => `Hi ${name}, thanks for booking. Here are the details:`,
  emailReminderSubject: (what) => `Reminder: ${what}`,
  emailReminderIntro: (name) => `Hi ${name}, a reminder about your upcoming meeting:`,
  emailCancelSubject: (what) => `Cancelled: ${what}`,
  emailCancelIntro: (name) => `Hi ${name}, your booking has been cancelled:`,
  emailWhen: "When",
  emailWhere: "Where",
  emailCancelLink: "Can't make it? Cancel here",
  emailBookAgain: "Book a new time",
};

export function publicText(language: string | null | undefined): PublicText {
  return language === "en" ? en : da;
}

/** "tirsdag 20. oktober kl. 10.00" / "Tuesday 20 October, 10:00", in the calendar's time zone. */
export function formatMeetingTime(iso: string, timeZone: string, language: string) {
  const text = publicText(language);
  return new Intl.DateTimeFormat(text.locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(iso));
}

/** Describes where a meeting happens, in the visitor's language. */
export function describeLocation(type: string, detail: string | null | undefined, language: string) {
  const label = publicText(language).location[type] ?? "";
  if (type === "custom") return detail ?? "";
  return detail ? `${label}${label ? ": " : ""}${detail}` : label;
}
