const modal =
    document.getElementById("passwordModal");

document
    .getElementById("openModal")
    .addEventListener("click", () => {

        modal.style.display = "flex";

    });

document
    .querySelector(".cancel-btn")
    .addEventListener("click", () => {

        modal.style.display = "none";

    });
