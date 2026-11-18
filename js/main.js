const uploadBtn =
    document.getElementById("uploadBtn");

const imageUpload =
    document.getElementById("imageUpload");

const uploadContent =
    document.getElementById("uploadContent");

const decideBtn =
    document.querySelector(".decide-btn");

uploadBtn.addEventListener("click", () => {

    imageUpload.click();

});

imageUpload.addEventListener("change", (e) => {

    const file =
        e.target.files[0];

    if (!file) return;

    const imageUrl =
        URL.createObjectURL(file);

    document.querySelector(".upload-box")
        .style.display = "none";

    let imageArea =
        document.querySelector(".selected-image-area");

    if (!imageArea) {

        imageArea =
            document.createElement("div");

        imageArea.className =
            "selected-image-area";

        document.querySelector(".tool-section")
            .insertBefore(
                imageArea,
                document.querySelector(".form-row")
            );

    }

   imageArea.innerHTML = `
    <div class="image-menu">
        ⋮
    </div>

    <img
        src="${imageUrl}"
        class="uploaded-image">
`;


});
document.addEventListener("click", (e) => {

    if (
        e.target.classList.contains(
            "image-menu"
        )
    ) {

        imageUpload.click();

    }

});