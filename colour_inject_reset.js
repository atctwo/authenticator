function css_reset(node) {
    function getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
    }

    node.style.transition = `filter ${getRandomInt(60, 100)}s, transform ${getRandomInt(60, 100)}s ease-in`;
    var filter = ``;
    node.style.filter = filter;
    node.style.webkitFilter = filter;
    node.style.transform = ``;

    console.log("transition", node.style.transition)
    console.log("filter", node.style.filter)
    console.log("webkit filter", node.style.webkitFilter)
    console.log("transform", node.style.transform)

    for (var i = 0; i < node.children.length; i++) css_reset(node.children[i])
}
css_reset(document.body)
window.css_reset = css_reset