const uploadBtn =
    document.getElementById("uploadBtn");

const imageUpload =
    document.getElementById("imageUpload");

uploadBtn.addEventListener("click", () => {

    imageUpload.click();

});
imageUpload.addEventListener("change", (e) => {

    const file =
        e.target.files[0];

    if (!file) return;

    console.log(file);

});
const previewImage =
    document.getElementById(
        "previewImage"
    );

imageUpload.addEventListener("change", (e) => {

    const file =
        e.target.files[0];

    if (!file) return;

    const imageUrl =
        URL.createObjectURL(file);

    previewImage.src =
        imageUrl;

    previewImage.style.display =
        "block";

});
const decideBtn =
    document.querySelector(".decide-btn");

decideBtn.addEventListener("click", () => {

    document.querySelector(".upload-content")
        .style.display = "none";

    document.querySelector(".loading-content")
        .style.display = "block";

    setTimeout(() => {

        document.querySelector(".loading-content")
            .style.display = "none";

        document.querySelector(".palette-content")
            .style.display = "block";

    }, 2000);

});