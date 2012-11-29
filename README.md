teachtables
===========

Edplan moved to node - v0.8.15

Timetables and test-plans

Dynamic quiz questions

Example:
Calculate:
$$ \frac{#A^{#a} \cdot #B^{#b} \cdot #C^{#c}}{#D^{#d} \cdot #E^{#e} \cdot #F^{#f}} $$
<p>
[[#w:0.2]]

All #a,#B .. etc
are replaced with generated values from javascript.
The script runs thru node on the server - only values delivered to client.
The script for this question:
  
r=rlist(2,6,3)   // random list from [2..6] length 3, no repeats
A=r.pop()
B=r.pop()
D=r.pop()
w=A*B/D
E=A
F=B
C=D
pot = alist(2,5,3)  // random list [2..5] length 3, repeats allowed
e=pot.pop()
f=pot.pop()
c=pot.pop()
a=e+1
b=f+1
d=c+1


