# Notes

* The titans.
* Dijkstra.
** Reasoning about programs.
** Angry Dijkstra vs programming languages.
** Dijkstra liked Lisp.
** Dijkstra hated Java.
** Did he finally discover JS?
* Today we do Agile.
** Developer Stockholm syndrome: think managers know best.
** Measuring velocity and the factory line fallacy.
** Pair programming is fun so we must make it right.
** Refactoring a pile of shit leaves you with better looking shit.
** We do anything to avoid having to learn anything too different.
* Dijkstra is very, very disappointed.
* We're trying to manage complexity.
* Reasons for complexity.
** State.
*** Mutable state breaks reasoning.
*** Bad for concurrency.
*** Breaks testing.
** Control.
*** Concurrency.


## Mutable State Is Bad

```java
class Number {
  private int number;
  public Number(int number) {
    this.number = number;
  }
  public int fac() {
    return (this.number == 0) ? 1 : this.number * new Number(this.number-1).fac();
  }
  public void set(int n) {
    this.number = n;
  }
  public static void mutableStateIsBad(Number n) {
    n.set(666);
  }
}

Number n = new Number(5);

Number.mutableStateIsBad(n);

n.fac();
```
