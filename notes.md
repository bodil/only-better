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
