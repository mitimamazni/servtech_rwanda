// Client-side mirror of the server's Rwanda-ID birth-year rules
// (see server/controllers/registrationController.js / clientController.js).
// Used to give instant inline feedback before a round-trip to the server.

// Rwanda national ID: positions 1-4 (0-indexed) encode the 4-digit birth year.
export const getIdBirthYear = (id_number) => {
  if (!id_number || id_number.length < 5) return null;
  const year = parseInt(id_number.substring(1, 5), 10);
  return Number.isNaN(year) ? null : year;
};

export const getAgeFromId = (id_number) => {
  const year = getIdBirthYear(id_number);
  if (year === null) return null;
  return new Date().getFullYear() - year;
};

// True only once both an ID number and a date of birth are present and their
// years actually disagree - so it never shows a false warning while a field
// is still empty/half-typed.
export const yearMismatch = (id_number, date_of_birth) => {
  const idYear = getIdBirthYear(id_number);
  if (idYear === null || !date_of_birth) return false;
  const dobYear = new Date(date_of_birth).getFullYear();
  if (Number.isNaN(dobYear)) return false;
  return idYear !== dobYear;
};
