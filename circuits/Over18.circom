pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template Over18() {
    // Private inputs
    signal input aadhaarNumber;
    signal input birthYear;
    signal input birthMonth;
    signal input birthDay;
    signal input salt;

    // Public inputs
    signal input currentYear;
    signal input currentMonth;
    signal input currentDay;
    signal input aadhaarHash;

    // Outputs
    signal output isOver18;

    // --- HASH VERIFICATION ---
    component hasher = Poseidon(5);
    hasher.inputs[0] <== aadhaarNumber;
    hasher.inputs[1] <== birthYear;
    hasher.inputs[2] <== birthMonth;
    hasher.inputs[3] <== birthDay;
    hasher.inputs[4] <== salt;
    hasher.out === aadhaarHash;

    // --- AGE VERIFICATION LOGIC ---
    // We want to check if:
    // currentDate >= (birthDate + 18 years)

    signal targetYear <== birthYear + 18;

    // Components for comparison
    component yearGreater = GreaterThan(32);
    component yearEqual = IsEqual();
    component monthGreater = GreaterThan(32);
    component monthEqual = IsEqual();
    component dayGreaterEq = GreaterEqThan(32);

    // 1. Is currentYear > targetYear?
    yearGreater.in[0] <== currentYear;
    yearGreater.in[1] <== targetYear;
    signal isYearGreater <== yearGreater.out;

    // 2. Is currentYear == targetYear?
    yearEqual.in[0] <== currentYear;
    yearEqual.in[1] <== targetYear;
    signal isYearEqual <== yearEqual.out;

    // 3. If years are equal, is currentMonth > birthMonth?
    monthGreater.in[0] <== currentMonth;
    monthGreater.in[1] <== birthMonth;
    signal isMonthGreater <== monthGreater.out;
    signal yearEqAndMonthGreater <== isYearEqual * isMonthGreater;

    // 4. If years and months are equal, is currentDay >= birthDay?
    monthEqual.in[0] <== currentMonth;
    monthEqual.in[1] <== birthMonth;
    signal isMonthEqual <== monthEqual.out;

    dayGreaterEq.in[0] <== currentDay;
    dayGreaterEq.in[1] <== birthDay;
    signal isDayGreaterEq <== dayGreaterEq.out;
    signal yearEqAndMonthEqAndDayGe <== isYearEqual * isMonthEqual * isDayGreaterEq;

    // isOver18 is true if any of the above conditions are met
    // (isYearGreater) OR (yearEqAndMonthGreater) OR (yearEqAndMonthEqAndDayGe)
    // Since these are mutually exclusive, we can sum them.
    // The result will be 1 if one is true, 0 otherwise.
    signal sum <== isYearGreater + yearEqAndMonthGreater + yearEqAndMonthEqAndDayGe;
    isOver18 <== sum;

    // Constraint to ensure the output is binary (0 or 1)
    isOver18 * (1 - isOver18) === 0;
}

component main { public [currentYear, currentMonth, currentDay, aadhaarHash] } = Over18();