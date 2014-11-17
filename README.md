teachtables
===========
Timetables and test-plans

Dynamic quiz questions

Example:

You have #a eggs and #b percent of them hatch into chickens.
After some weeks #c percent of them start to lay eggs and they lay #d eggs each.
How many hens will lay how many eggs next week?
<p>
Answer : [[#A]] hens will lay [[#B]] eggs
</p>

// javascript code connected to question (opens on edit details)
a = 20 + roll(100)
b = 75 + roll(22)
c = 20 + roll(50)
d = roll(9)
A = Math.floor(a*b/100)
B = d*A

