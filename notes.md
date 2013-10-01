## Mutable State Is Bad

```java
class Number {
  private long number;
  public Number(long number) {
    this.number = number;
  }
  public long fac() {
    return (this.number == 0) ? 1 : this.number * new Number(this.number-1).fac();
  }
  public void set(long n) {
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

## Declarative Programming Now

```clojure
(run* [a b c]
  (== a 2)
  (+ a 3 b)
  (* b 2 c))

(run* [a b]
  (in a b (interval 1 10))
  (+ a b 10)
  (!= a b))
```
