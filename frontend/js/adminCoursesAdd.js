let uploadedCourseImageUrl = "";

const addCourseBtn = document.getElementById("addCourseBtn");
const uploadForm = document.getElementById("uploadForm");
const result = document.getElementById("result");
const deleteUrl = document.getElementById("deleteUrl");
const deleteBtn = document.getElementById("deleteBtn");
const deleteMessage = document.getElementById("deleteMessage");
const newCourseImage = document.getElementById("newCourseImage");

addCourseBtn.addEventListener("click", async () => {
  const title = document.getElementById("newCourseTitle").value.trim();
  const description = document.getElementById("newCourseDescription").value.trim();
  const image = newCourseImage.value.trim() || uploadedCourseImageUrl;
  if (!title || !description) return alert("Назва та опис обов'язкові!");

  const res = await fetch("http://localhost:5002/api/courses/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, image }),
  });

  if (res.ok) {
    document.getElementById("newCourseTitle").value = "";
    document.getElementById("newCourseDescription").value = "";
    newCourseImage.value = "";
    uploadedCourseImageUrl = "";
    updateSelects();
  } else {
    const data = await res.json();
    alert(data.error || "Помилка при додаванні курсу");
  }
});

// --- Завантаження картинки ---
uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  result.textContent = "";
  const formData = new FormData(uploadForm);
  try {
    const res = await fetch("http://localhost:5002/api/image", { method: "POST", body: formData });
    const data = await res.json();
    if (res.ok) {
      uploadedCourseImageUrl = data.url;
      newCourseImage.value = uploadedCourseImageUrl;
      result.innerHTML = `<img src="${data.url}" width="150">`;
      deleteUrl.value = data.url;
      document.getElementById("deleteContainer").style.display = "block";
    } else result.textContent = data.error || "Помилка завантаження";
  } catch (err) {
    console.error(err);
    result.textContent = "Помилка при завантаженні";
  }
});

// --- Видалення картинки ---
deleteBtn.addEventListener("click", async () => {
  const url = deleteUrl.value;
  try {
    const res = await fetch("http://localhost:5002/api/image", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (res.ok) {
      deleteMessage.textContent = "Картинку успішно видалено!";
      result.innerHTML = "";
      deleteUrl.value = "";
      uploadedCourseImageUrl = "";
      newCourseImage.value = "";
      document.getElementById("deleteContainer").style.display = "none";
      uploadForm.reset();
    } else {
      const data = await res.json();
      deleteMessage.textContent = data.error || "Помилка видалення";
    }
  } catch (err) {
    console.error(err);
    deleteMessage.textContent = "Помилка при видаленні";
  }
});
