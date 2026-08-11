import '@testing-library/jest-dom'

// jsdom nie implementuje scrollTo. Karuzela zdjęć nim przewija, więc bez tej
// atrapy każdy test dotykający strzałek wywala się na braku metody, zamiast
// sprawdzić to, o co pyta.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo() {}
}
