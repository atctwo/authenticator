function css_modifier(node) {
    function getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
    }
    var random_colour = () => { var c = "#"; for (var i = 0; i < 3; i++) { c += Math.round(Math.random() * 255).toString(16).padStart(2, "0") }; return c }

    node.style.transition = `filter ${getRandomInt(60, 100)}s, transform ${getRandomInt(60, 100)}s ease-in`;
    var filter = `blur(${getRandomInt(0, 0.5)}px) hue-rotate(${getRandomInt(0, 180)}deg) invert(${getRandomInt(0, 5)}%) drop-shadow(${getRandomInt(0, 1)}px ${getRandomInt(0, 1)}px ${getRandomInt(0, 5)}px ${random_colour()}) brightness(${getRandomInt(100, 110)}%) contrast(${getRandomInt(100, 110)}%)`;
    node.style.filter = filter;
    node.style.webkitFilter = filter;
    node.style.transform = `scale(${getRandomInt(90, 110)}%, ${getRandomInt(90, 110)}%) rotate(${4 - getRandomInt(0, 8)}deg) translate(${10 - getRandomInt(0, 20)}px, ${10 - getRandomInt(0, 20)}px)`;

    console.log("transition", node.style.transition)
    console.log("filter", node.style.filter)
    console.log("webkit filter", node.style.webkitFilter)
    console.log("transform", node.style.transform)

    for (var i = 0; i < node.children.length; i++) css_modifier(node.children[i])
}
css_modifier(document.body)
window.css_modifier = css_modifier