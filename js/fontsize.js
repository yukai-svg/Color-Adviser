const root = document.documentElement;

document.getElementById("font-small")
.addEventListener("click", () => {
    root.style.fontSize = "14px";
});

document.getElementById("font-medium")
.addEventListener("click", () => {
    root.style.fontSize = "18px";  
});

document.getElementById("font-large")
.addEventListener("click", () => {
    root.style.fontSize = "22px";  
});