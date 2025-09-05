pragma circom 2.0.0;

include "poseidon.circom";
include "comparators.circom";

template Over18() {
    // Private inputs
    signal input aadhaarNumber;
    signal input birthYear;
    signal input birthMonth;
    signal input birthDay;
    signal input salt;
    signal input secret;

    // Public inputs
    signal input currentYear;
    signal input currentMonth;
    signal input currentDay;
    signal input aadhaarHash;
    signal input secretHash;
    signal input requestIdentifier; // e.g., the requestId from the contract
    signal input verifierIdentifier; // The address of the company/verifier

    // Outputs
    signal output isOver18;
    signal output nullifierHash;

    // --- HASH VERIFICATION ---
    component dataHasher = Poseidon(5);
    dataHasher.inputs[0] <== aadhaarNumber;
    dataHasher.inputs[1] <== birthYear;
    dataHasher.inputs[2] <== birthMonth;
    dataHasher.inputs[3] <== birthDay;
    dataHasher.inputs[4] <== salt;
    dataHasher.out === aadhaarHash;

    // --- SECRET HASH VERIFICATION ---
    component secretHasher = Poseidon(1);
    secretHasher.inputs[0] <== secret;
    secretHasher.out === secretHash;

    // --- NULLIFIER GENERATION ---
    // The nullifier is now unique for this user, this request, AND this verifier
    component nullifierHasher = Poseidon(3);
    nullifierHasher.inputs[0] <== secret;
    nullifierHasher.inputs[1] <== requestIdentifier;
    nullifierHasher.inputs[2] <== verifierIdentifier;
    nullifierHash <== nullifierHasher.out;

    // --- ACCURATE AGE VERIFICATION LOGIC ---
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

    // Break down cubic constraint into two quadratic constraints
    signal yearEqAndMonthEq <== isYearEqual * isMonthEqual;
    signal yearEqAndMonthEqAndDayGe <== yearEqAndMonthEq * isDayGreaterEq;

    // isOver18 is true if any of the conditions are met
    signal sum <== isYearGreater + yearEqAndMonthGreater + yearEqAndMonthEqAndDayGe;
    isOver18 <== sum;

    // Constraint to ensure the output is binary (0 or 1)
    isOver18 * (1 - isOver18) === 0;
}

component main { public [currentYear, currentMonth, currentDay, aadhaarHash, secretHash, requestIdentifier, verifierIdentifier] } = Over18();