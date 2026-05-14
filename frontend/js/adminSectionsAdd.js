// --- Додавання секцій ---
let uploadedSectionImageUrl = ""; // для картинки секції

// === Універсальні функції ===
async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch("http://localhost:5002/api/image", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Помилка завантаження");
  return data.url;
}

async function deleteImage(url) {
  const res = await fetch("http://localhost:5002/api/image", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Помилка видалення");
  return true;
}

// === Логіка для секції ===


// --- Завантаження картинки ---
const sectionUploadForm = document.getElementById("sectionUploadForm");
const sectionFileInput = document.getElementById("sectionFile");
const sectionResult = document.getElementById("sectionResult");
const sectionDeleteUrl = document.getElementById("sectionDeleteUrl");
const sectionDeleteBtn = document.getElementById("sectionDeleteBtn");
const sectionDeleteMessage = document.getElementById("sectionDeleteMessage");
const newSectionImage = document.getElementById("newSectionImage");

sectionUploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  sectionResult.textContent = "";

  const file = sectionFileInput.files[0];
  if (!file) return alert("Оберіть файл!");

  try {
    const url = await uploadImage(file); // універсальна функція
    uploadedSectionImageUrl = url;
    newSectionImage.value = url;

    sectionResult.innerHTML = `
      URL: <a href="${url}" target="_blank">${url}</a><br>
      <img src="${url}" width="300" alt="Завантажена картинка"/>
    `;

    sectionDeleteUrl.value = url;
    document.getElementById("sectionDeleteContainer").style.display = "block";
  } catch (err) {
    sectionResult.textContent = err.message;
  }
});

// --- Видалення картинки ---
sectionDeleteBtn.addEventListener("click", async () => {
  sectionDeleteMessage.textContent = "";
  const url = sectionDeleteUrl.value;
  if (!url) return;

  try {
    await deleteImage(url); // універсальна функція
    sectionDeleteMessage.textContent = "Картинку успішно видалено!";
    sectionResult.innerHTML = "";
    sectionDeleteUrl.value = "";
    uploadedSectionImageUrl = "";
    newSectionImage.value = "";
    document.getElementById("sectionDeleteContainer").style.display = "none";
    sectionUploadForm.reset();
  } catch (err) {
    sectionDeleteMessage.textContent = err.message;
  }
});

// --- Додавання секції ---
document.getElementById("addSectionBtn").addEventListener("click", async () => {
  const courseId = document.getElementById("courseSelectSection").value;
  const title = document.getElementById("newSectionTitle").value.trim();
  const description = document.getElementById("newSectionDescription").value.trim();
  const image = newSectionImage.value.trim() || uploadedSectionImageUrl;

  if (!title) return alert("Назва секції обов'язкова");
  const bodyData = { title, description, image };

  console.log("addSectionBtn: дані, що відправляються на бекенд:", bodyData);
  const res = await fetch(`http://localhost:5002/api/courses/${courseId}/section`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, image }),
  });

  if (res.ok) {
    document.getElementById("newSectionTitle").value = "";
    document.getElementById("newSectionDescription").value = "";
    newSectionImage.value = "";
    uploadedSectionImageUrl = "";
    sectionResult.innerHTML = "";
    document.getElementById("sectionDeleteContainer").style.display = "none";
    updateSelects();
  } else {
    const data = await res.json();
    alert(data.error || "Помилка при додаванні секції");
  }
});