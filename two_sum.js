function twoSum(arr, target) {
    let seen = new Set();
    for (let num of arr) {
        if (seen.has(target - num)) return true;
        seen.add(num);
    }
    return false;
}

let arr = [0, -1, 2, -3, 1];
let target = -2;

if (twoSum(arr, target))
    console.log("true");
else 
    console.log("false");