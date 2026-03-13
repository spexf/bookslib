using System;

int a = 5;
int b = 5;

if (a + b != 10)
{
    Console.WriteLine("Test Failed!");
    Environment.Exit(1);
}

Console.WriteLine("Test Passed!");