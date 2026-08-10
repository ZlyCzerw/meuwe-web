// Kiedy organizator ma usłyszeć, że ktoś się wybiera na jego wydarzenie.
//
// Na początku każda osoba jest informacją; przy dużym wydarzeniu liczy się już
// tylko rząd wielkości. Trzydzieści powiadomień o trzydziestu osobach kończy
// się wyciszeniem aplikacji, więc drabinka rzednie wraz ze wzrostem.

const LADDER = [10, 15, 20, 30, 40, 50, 70, 100]

export function interestMilestones(count: number): boolean {
  if (count <= 0) return false
  if (count <= 5) return true
  if (count <= 100) return LADDER.includes(count)
  return count % 50 === 0
}

/**
 * `notifiedAt` to ostatnia liczba, o której powiadomiono, trzymana na
 * events.interest_notified_count. Porównanie z nią, zamiast samego progu,
 * załatwia dwa równoczesne dołączenia: oba policzą tę samą wartość, ale tylko
 * pierwsze zdąży ją zapisać. Licznik nigdy nie schodzi w dół, więc odejście i
 * powrót obserwującego nie wysyła powiadomienia o tym samym progu drugi raz.
 */
export function shouldNotifyInterest(notifiedAt: number, count: number): boolean {
  return count > notifiedAt && interestMilestones(count)
}
