var input = null

// test file select thing
// var input = document.createElement("input");
// input.type = "file";
// input.onchange = (event) => {
//     console.log(event)
//     console.log(input.files)
// }
// input.click();

// if there is a field id
if (config.input_id)
{
    console.log("input id", config.input_id)
    // get the input element based on ID
    input = document.getElementById(config.input_id)
}
// otherwise, check if there is an xpath
else if (config.xpath)
{
    console.log("xpath", config.xpath)
    // get the input element based on an xpath
    var xpath_result = document.evaluate(config.xpath, document, null, XPathResult.ANY_TYPE, null );
    input = xpath_result.iterateNext();
}
console.log("input", input)

// check if input was found
if (input) {
    input.value = config.value
} else {
    console.warn("couldn't get element with id", config.input_id)
}