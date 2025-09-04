pragma circom 2.0.0;

include "poseidon.circom";
include "comparators.circom";

template Over18() {
    // Private inputs (hidden)
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
    signal output outCurrentYear;
    signal output outCurrentMonth;
    signal output outCurrentDay;
    signal output outAadhaarHash;
    
    // Components
    component hasher = Poseidon(5);
    component ageCompare = GreaterEqThan(32);
    
    // Hash Aadhaar data
    hasher.inputs[0] <== aadhaarNumber;
    hasher.inputs[1] <== birthYear;
    hasher.inputs[2] <== birthMonth;
    hasher.inputs[3] <== birthDay;
    hasher.inputs[4] <== salt;
    
    // Check hash matches Aadhaar hash
    hasher.out === aadhaarHash;
    
    // Calculate age in days
    signal ageInDays <== (currentYear - birthYear) * 365 + (currentMonth - birthMonth) * 30 + (currentDay - birthDay);
    signal eighteenYearsInDays <== 18 * 365;
    
    // Check if age >= 18
    ageCompare.in[0] <== ageInDays;
    ageCompare.in[1] <== eighteenYearsInDays;
    isOver18 <== ageCompare.out;

    // Expose current date and Aadhaar hash as outputs
    outCurrentYear <== currentYear;
    outCurrentMonth <== currentMonth;
    outCurrentDay <== currentDay;
    outAadhaarHash <== aadhaarHash;
}

component main = Over18();
