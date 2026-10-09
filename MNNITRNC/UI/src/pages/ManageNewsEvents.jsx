import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../layout/useTheme";
import {
  CalendarDays,
  Megaphone,
  Pencil,
  Trash2,
  Plus,
  FileText,
  Image as ImageIcon,
  Search,
  Filter,
  RefreshCw,
  X,
  Save,
  Newspaper,
  CirclePlus,
  ClipboardList,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  getNewsEvents,
  createNewsEvent,
  updateNewsEvent,
  deleteNewsEvent,
} from "../api/newsEventsApi";

const emptyForm = {
  id: null,
  title: "",
  type: "News",
  content: "",
  eventDate: "",
  titleImage: "",
  additionalImages: [],
};

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

const ManageNewsEvents = () => {
  useTheme();
  const [newsList, setNewsList] = useState([]);
  const [mode, setMode] = useState("manage"); // "manage" | "edit"

  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState("All");

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forms
  const [addFormData, setAddFormData] = useState(emptyForm);
  const [editFormData, setEditFormData] = useState(emptyForm);

  // Toast Notification State
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 4000);
  };

  const addTitleImageRef = useRef(null);
  const addAdditionalImagesRef = useRef(null);
  const editTitleImageRef = useRef(null);
  const editAdditionalImagesRef = useRef(null);

  // Fetch News & Events from Backend
  const fetchNewsEvents = async () => {
    setIsLoading(true);
    try {
      const data = await getNewsEvents();
      const mapped = data.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type
          ? item.type.charAt(0).toUpperCase() + item.type.slice(1)
          : "News",
        content: item.content,
        eventDate: item.eventDate || "",
        titleImage: item.imagePath || "",
        additionalImages: item.additionalImages || [],
      }));
      setNewsList(mapped);
    } catch (err) {
      console.error("Failed to load news & events", err);
      showToast(err.message || "Failed to load news and events.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNewsEvents();
  }, []);

  const filteredNews = useMemo(() => {
    return newsList.filter((item) => {
      const searchMatch =
        item.title.toLowerCase().includes(searchText.toLowerCase()) ||
        item.content.toLowerCase().includes(searchText.toLowerCase());

      const typeMatch =
        filterType === "All" ||
        item.type.toLowerCase() === filterType.toLowerCase();

      return searchMatch && typeMatch;
    });
  }, [newsList, searchText, filterType]);

  /* =========================================================
     ADD FORM HANDLERS
  ========================================================= */

  const handleAddChange = (e) => {
    const { name, value } = e.target;
    setAddFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddTitleImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      setAddFormData((prev) => ({
        ...prev,
        titleImage: base64,
      }));
    } catch {
      showToast("Failed to process image", "error");
    }
  };

  const handleAddAdditionalImages = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = 4 - addFormData.additionalImages.length;
    if (remaining <= 0) {
      showToast("Maximum 4 additional images are allowed.", "error");
      return;
    }

    try {
      const selectedFiles = files.slice(0, remaining);
      const base64List = await Promise.all(
        selectedFiles.map((f) => fileToBase64(f)),
      );

      setAddFormData((prev) => ({
        ...prev,
        additionalImages: [...prev.additionalImages, ...base64List],
      }));
    } catch {
      showToast("Failed to process additional images", "error");
    }

    e.target.value = "";
  };

  const removeAddAdditionalImage = (index) => {
    setAddFormData((prev) => ({
      ...prev,
      additionalImages: prev.additionalImages.filter((_, i) => i !== index),
    }));
  };

  const resetAddForm = () => {
    setAddFormData({ ...emptyForm });
    if (addTitleImageRef.current) addTitleImageRef.current.value = "";
    if (addAdditionalImagesRef.current)
      addAdditionalImagesRef.current.value = "";
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    // Mandatory Field Validation (Frontend)
    if (!addFormData.title.trim()) {
      showToast("Title is required.", "error");
      return;
    }

    if (!addFormData.type) {
      showToast("Type is required.", "error");
      return;
    }

    if (!addFormData.content.trim()) {
      showToast("Content is required.", "error");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (addFormData.eventDate && addFormData.eventDate < todayStr) {
      showToast("Event Date cannot be in the past.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: addFormData.title.trim(),
        type: addFormData.type ? addFormData.type.toLowerCase() : "news",
        content: addFormData.content.trim(),
        eventDate:
          addFormData.eventDate && addFormData.eventDate.trim() !== ""
            ? addFormData.eventDate
            : null,
        imagePath:
          addFormData.titleImage && addFormData.titleImage.trim() !== ""
            ? addFormData.titleImage
            : null,
        additionalImages: addFormData.additionalImages || [],
      };

      const res = await createNewsEvent(payload);
      showToast("News/Event created successfully!", "success");

      const newItem = {
        id: res.id,
        title: res.title,
        type: res.type
          ? res.type.charAt(0).toUpperCase() + res.type.slice(1)
          : "News",
        content: res.content,
        eventDate: res.eventDate || "",
        titleImage: res.imagePath || "",
        additionalImages: res.additionalImages || [],
      };

      setNewsList((prev) => [newItem, ...prev]);
      resetAddForm();
    } catch (err) {
      console.error("Failed to create news/event", err);
      showToast(err.message || "Failed to create news/event.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* =========================================================
     EDIT FORM HANDLERS
  ========================================================= */

  const handleEdit = (item) => {
    setEditFormData({
      id: item.id,
      title: item.title,
      type: item.type,
      content: item.content,
      eventDate: item.eventDate,
      titleImage: item.titleImage,
      additionalImages: [...item.additionalImages],
    });
    setMode("edit");
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditTitleImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      setEditFormData((prev) => ({
        ...prev,
        titleImage: base64,
      }));
    } catch {
      showToast("Failed to process image", "error");
    }
  };

  const handleEditAdditionalImages = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = 4 - editFormData.additionalImages.length;
    if (remaining <= 0) {
      showToast("Maximum 4 additional images are allowed.", "error");
      return;
    }

    try {
      const selectedFiles = files.slice(0, remaining);
      const base64List = await Promise.all(
        selectedFiles.map((f) => fileToBase64(f)),
      );

      setEditFormData((prev) => ({
        ...prev,
        additionalImages: [...prev.additionalImages, ...base64List],
      }));
    } catch {
      showToast("Failed to process additional images", "error");
    }

    e.target.value = "";
  };

  const removeEditAdditionalImage = (index) => {
    setEditFormData((prev) => ({
      ...prev,
      additionalImages: prev.additionalImages.filter((_, i) => i !== index),
    }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    // Mandatory Field Validation (Frontend)
    if (!editFormData.title.trim()) {
      showToast("Title is required.", "error");
      return;
    }

    if (!editFormData.type) {
      showToast("Type is required.", "error");
      return;
    }

    if (!editFormData.content.trim()) {
      showToast("Content is required.", "error");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (editFormData.eventDate && editFormData.eventDate < todayStr) {
      showToast("Event Date cannot be in the past.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: editFormData.title.trim(),
        type: editFormData.type ? editFormData.type.toLowerCase() : "news",
        content: editFormData.content.trim(),
        eventDate:
          editFormData.eventDate && editFormData.eventDate.trim() !== ""
            ? editFormData.eventDate
            : null,
        imagePath:
          editFormData.titleImage && editFormData.titleImage.trim() !== ""
            ? editFormData.titleImage
            : null,
        additionalImages: editFormData.additionalImages || [],
      };

      const res = await updateNewsEvent(editFormData.id, payload);
      showToast("News/Event updated successfully!", "success");

      const updatedItem = {
        id: res.id,
        title: res.title,
        type: res.type
          ? res.type.charAt(0).toUpperCase() + res.type.slice(1)
          : "News",
        content: res.content,
        eventDate: res.eventDate || "",
        titleImage: res.imagePath || "",
        additionalImages: res.additionalImages || [],
      };

      setNewsList((prev) =>
        prev.map((item) => (item.id === res.id ? updatedItem : item)),
      );
      setMode("manage");
    } catch (err) {
      console.error("Failed to update news/event", err);
      showToast(err.message || "Failed to update news/event.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setMode("manage");
  };

  /* =========================================================
     DELETE / RESET HANDLERS
  ========================================================= */

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this news/event?",
    );
    if (!confirmDelete) return;

    try {
      await deleteNewsEvent(id);
      showToast("News/Event deleted successfully!", "success");
      setNewsList((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete news/event", err);
      showToast(err.message || "Failed to delete news/event.", "error");
    }
  };

  const resetFilters = () => {
    setSearchText("");
    setFilterType("All");
  };

  /* =========================================================
     RENDER
  ========================================================= */

  if (mode === "edit") {
    return (
      <NewsForm
        mode="edit"
        formData={editFormData}
        handleChange={handleEditChange}
        handleCancel={handleCancelEdit}
        handleSubmit={handleUpdate}
        handleTitleImage={handleEditTitleImage}
        handleAdditionalImages={handleEditAdditionalImages}
        removeAdditionalImage={removeEditAdditionalImage}
        titleImageRef={editTitleImageRef}
        additionalImagesRef={editAdditionalImagesRef}
        isSubmitting={isSubmitting}
        toast={toast}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fc] dark:bg-slate-900 px-2 py-2 md:px-7 transition-colors duration-200">
      {/* Toast Notification Banner */}
      {toast.show && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 shadow-2xl transition-all duration-300 ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <div className="max-w-[1530px]">
        {/* HEADER */}
        <div className="relative mb-4 overflow-hidden rounded-2xl border border-[#e5e9f2] dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4 shadow-sm transition-colors duration-200">
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-[50px] w-[50px] items-center justify-center rounded-xl shadow-lg">
              <CalendarDays size={28} className="text-white" />
            </div>

            <div>
              <h1 className="text-[25px] font-bold text-[#122653] dark:text-slate-100">
                Manage News & Events
              </h1>

              <p className="mt-0.5 text-[13px] text-[#52678f] dark:text-slate-400">
                Create and manage news updates, events and important
                announcements.
              </p>
            </div>
          </div>

          <div className="pointer-events-none absolute right-8 top-0 opacity-30">
            <Megaphone size={90} strokeWidth={1} className="text-[#6557ed]" />
          </div>
        </div>

        {/* ADD NEWS / EVENT FORM */}
        <section className="mb-3 rounded-2xl border border-[#e2e7f0] dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm transition-colors duration-200">
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 gap-x-8 gap-y-2 lg:grid-cols-2">
              {/* TITLE */}
              <FormInput label="Title" required icon={<FileText size={18} />}>
                <input
                  type="text"
                  name="title"
                  placeholder="Enter title"
                  className="manage-input pl-[56px]"
                  value={addFormData.title}
                  onChange={handleAddChange}
                  required
                />
              </FormInput>

              {/* TYPE */}
              <FormInput label="Type" required icon={<Newspaper size={18} />}>
                <select
                  name="type"
                  className="manage-input appearance-none pl-[56px]"
                  value={addFormData.type}
                  onChange={handleAddChange}
                  required
                >
                  <option value="News">News</option>
                  <option value="Event">Event</option>
                </select>
              </FormInput>

              {/* CONTENT */}
              <div className="lg:col-span-2">
                <FormInput
                  label="Content"
                  required
                  icon={<Pencil size={18} />}
                  isTextarea
                >
                  <textarea
                    name="content"
                    rows={2}
                    placeholder="Write content here..."
                    className="manage-textarea pl-[56px]"
                    value={addFormData.content}
                    onChange={handleAddChange}
                    required
                  />
                </FormInput>
              </div>

              {/* EVENT DATE */}
              <FormInput
                label={
                  <>
                    Event Date{" "}
                    <span className="font-normal">(if applicable)</span>
                  </>
                }
                icon={<CalendarDays size={18} />}
              >
                <input
                  type="date"
                  name="eventDate"
                  min={new Date().toISOString().split("T")[0]}
                  className="manage-input pl-[56px]"
                  value={addFormData.eventDate}
                  onChange={handleAddChange}
                />
              </FormInput>

              {/* TITLE IMAGE */}
              <div>
                <label className="block text-[14px] font-semibold text-[#18305f] dark:text-slate-200">
                  Title Image{" "}
                  <span className="font-normal">(for index page)</span>
                </label>

                <input
                  ref={addTitleImageRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAddTitleImage}
                  className="manage-file"
                />

                <p className="mt-1 text-[12px] text-[#52678f] dark:text-slate-400">
                  Recommended size: 1200 × 630 px
                </p>

                {addFormData.titleImage && (
                  <div className="relative mt-3 w-fit">
                    <img
                      src={addFormData.titleImage}
                      alt="Title preview"
                      className="h-[105px] w-[220px] rounded-lg object-cover"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        setAddFormData((prev) => ({
                          ...prev,
                          titleImage: "",
                        }));
                        if (addTitleImageRef.current) {
                          addTitleImageRef.current.value = "";
                        }
                      }}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* ADDITIONAL IMAGES */}
              <div className="lg:col-span-2">
                <label className="mb-1 block text-[14px] font-semibold text-[#18305f] dark:text-slate-200">
                  Additional Images <span className="font-normal">(max 4)</span>
                </label>

                <input
                  ref={addAdditionalImagesRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleAddAdditionalImages}
                  className="w-full rounded-lg border border-[#d8deeb] dark:border-slate-600 p-2 bg-white dark:bg-slate-700 text-[#334777] dark:text-slate-300 transition-colors"
                />

                <p className="mt-1 text-[12px] text-[#52678f] dark:text-slate-400">
                  You can select up to 4 additional images to show in the
                  detailed view.
                </p>

                {addFormData.additionalImages.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-4">
                    {addFormData.additionalImages.map((image, index) => (
                      <div key={`${image}-${index}`} className="relative">
                        <img
                          src={image}
                          alt=""
                          className="h-[105px] w-[180px] rounded-lg object-cover"
                        />

                        <button
                          type="button"
                          onClick={() => removeAddAdditionalImage(index)}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:opacity-95 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 size={19} className="animate-spin" />
                ) : (
                  <Plus size={19} />
                )}
                {isSubmitting ? "Saving..." : "Add News/Event"}
              </button>

              {(addFormData.title ||
                addFormData.content ||
                addFormData.eventDate ||
                addFormData.titleImage ||
                addFormData.additionalImages.length > 0) && (
                <button
                  type="button"
                  onClick={resetAddForm}
                  className="flex items-center gap-2 rounded-lg border border-[#d7deeb] dark:border-slate-600 bg-white dark:bg-slate-700 px-5 py-2.5 text-sm font-semibold text-[#344464] dark:text-slate-200 hover:bg-[#f1f4ff] dark:hover:bg-slate-600 transition-colors"
                >
                  <X size={18} />
                  Clear
                </button>
              )}
            </div>
          </form>
        </section>

        {/* EXISTING NEWS & EVENTS TABLE */}
        <section className="rounded-2xl border border-[#e2e7f0] dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm transition-colors duration-200">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0efff] dark:bg-slate-700">
                <Newspaper
                  size={22}
                  className="text-[#5c56e9] dark:text-blue-400"
                />
              </div>

              <h2 className="text-[19px] font-bold text-[#2438bd] dark:text-slate-100">
                Existing News & Events
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">
              {/* SEARCH */}
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] dark:text-slate-400"
                />

                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search news or events..."
                  className="h-10 w-[270px] rounded-lg border border-[#dce2ed] dark:border-slate-600 pl-10 pr-3 text-sm outline-none focus:border-[#6b63ee] dark:focus:border-blue-400 bg-white dark:bg-slate-700 text-[#1d315d] dark:text-slate-100 transition-colors"
                />
              </div>

              {/* FILTER */}
              <div className="relative">
                <Filter
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] dark:text-slate-400"
                />

                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="h-10 appearance-none rounded-lg border border-[#dce2ed] dark:border-slate-600 bg-white dark:bg-slate-700 pl-9 pr-9 text-sm text-[#334155] dark:text-slate-200 outline-none transition-colors"
                >
                  <option value="All">Filter</option>
                  <option value="News">News</option>
                  <option value="Event">Event</option>
                </select>
              </div>

              {/* REFRESH */}
              <button
                type="button"
                onClick={() => {
                  resetFilters();
                  fetchNewsEvents();
                }}
                className="flex h-10 w-14 items-center justify-center rounded-lg border border-[#dce2ed] dark:border-slate-600 text-[#53627e] dark:text-slate-400 hover:bg-[#f7f8fc] dark:hover:bg-slate-700 transition-colors"
              >
                <RefreshCw
                  size={18}
                  className={isLoading ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse">
              <thead>
                <tr className="bg-[#f7f8fd] dark:bg-slate-700 text-left text-[13px] font-bold text-[#25365f] dark:text-slate-200 transition-colors">
                  <th className="px-3 py-3">Title</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Images</th>
                  <th className="px-3 py-3 text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center text-sm text-slate-500"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Loader2
                          size={20}
                          className="animate-spin text-indigo-600"
                        />
                        <span>Loading news and events...</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredNews.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[#edf0f5] dark:border-slate-700 text-[14px] text-[#29395e] dark:text-slate-300 transition-colors"
                    >
                      {/* TITLE */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-4">
                          {item.titleImage ? (
                            <img
                              src={item.titleImage}
                              alt=""
                              className="h-10 w-[70px] rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-[70px] items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400">
                              <ImageIcon size={18} />
                            </div>
                          )}

                          <span className="max-w-[620px] font-medium">
                            {item.title}
                          </span>
                        </div>
                      </td>

                      {/* TYPE */}
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-md px-3 py-1 text-xs font-medium ${
                            item.type.toLowerCase() === "event"
                              ? "bg-[#eeeeff] text-[#6259ed]"
                              : "bg-[#e7f8ef] text-[#16a568]"
                          }`}
                        >
                          {item.type}
                        </span>
                      </td>

                      {/* DATE */}
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="flex items-center gap-2">
                          <CalendarDays
                            size={16}
                            className="text-[#66748e] dark:text-slate-400"
                          />
                          {formatDate(item.eventDate)}
                        </div>
                      </td>

                      {/* IMAGES */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <ImageIcon
                            size={16}
                            className="text-[#69758d] dark:text-slate-400"
                          />
                          {item.additionalImages.length} images
                        </div>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-3 py-2">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="flex items-center gap-1.5 rounded-lg border border-[#6c86ff] dark:border-blue-500 px-3 py-1.5 text-xs font-medium text-[#3560e9] dark:text-blue-400 hover:bg-[#f1f4ff] dark:hover:bg-blue-900/20 transition-colors"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="flex items-center gap-1.5 rounded-lg border border-[#ff6a6a] dark:border-red-500 px-3 py-1.5 text-xs font-medium text-[#f04444] dark:text-red-400 hover:bg-[#fff3f3] dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}

                {!isLoading && filteredNews.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      No news or events found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <p className="text-[13px] text-[#596b8e] dark:text-slate-400">
              Showing 1 to {filteredNews.length} of {filteredNews.length}{" "}
              entries
            </p>
          </div>
        </section>
      </div>

      <style>{`
        .manage-input {
          width: 100%;
          height: 42px;
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          padding-right: 15px;
          font-size: 14px;
          color: #1e293b;
          outline: none;
          box-sizing: border-box;
          transition: all 0.2s ease-in-out;
        }

        .manage-input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }

        .dark .manage-input {
          background: #1e293b;
          border-color: #475569;
          color: #f8fafc;
        }

        .dark .manage-input:focus {
          border-color: #818cf8;
          box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.15);
        }

        .manage-textarea {
          width: 100%;
          min-height: 105px;
          resize: vertical;
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          padding-top: 10px;
          padding-right: 15px;
          font-size: 14px;
          line-height: 1.6;
          color: #1e293b;
          outline: none;
          box-sizing: border-box;
          transition: all 0.2s ease-in-out;
        }

        .manage-textarea:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }

        .dark .manage-textarea {
          background: #1e293b;
          border-color: #475569;
          color: #f8fafc;
        }

        .dark .manage-textarea:focus {
          border-color: #818cf8;
          box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.15);
        }

        .manage-file {
          width: 100%;
          height: 42px;
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 14px;
          color: #334155;
          box-sizing: border-box;
          background: #ffffff;
          transition: all 0.2s ease-in-out;
        }

        .dark .manage-file {
          background: #1e293b;
          border-color: #475569;
          color: #f8fafc;
        }
      `}</style>
    </div>
  );
};

/* =============================================================
   EDIT FORM COMPONENT
============================================================= */

const NewsForm = ({
  mode,
  formData,
  handleChange,
  handleCancel,
  handleSubmit,
  handleTitleImage,
  handleAdditionalImages,
  removeAdditionalImage,
  titleImageRef,
  additionalImagesRef,
  isSubmitting,
  toast,
}) => {
  const isEdit = mode === "edit";

  return (
    <div className="min-h-screen bg-[#f5f7fc] dark:bg-slate-900 px-4 py-3 md:px-7 transition-colors duration-200">
      {/* Toast Notification Banner */}
      {toast.show && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 shadow-2xl transition-all duration-300 ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <div className="max-w-[1530px]">
        {/* HEADER */}
        <div className="relative mb-4 overflow-hidden rounded-2xl border border-[#e5e9f2] dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4 shadow-sm transition-colors duration-200">
          <div className="relative z-10 flex items-center gap-6">
            <div className="flex h-[50px] w-[50px] items-center justify-center rounded-xl shadow-lg">
              <Pencil size={28} className="text-white" />
            </div>

            <div>
              <h1 className="text-[25px] font-bold text-[#122653] dark:text-slate-100">
                {isEdit ? "Edit News & Event" : "News & Event"}
              </h1>

              <p className="mt-0.5 text-[15px] text-[#52678f] dark:text-slate-400">
                Update the details of the news or event and keep your audience
                informed.
              </p>
            </div>
          </div>

          <div className="pointer-events-none absolute right-8 top-0 opacity-30">
            <ClipboardList size={90} className="text-[#5d5aed]" />
          </div>
        </div>

        {/* FORM */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[#e0e5ef] dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm transition-colors duration-200"
        >
          <div className="grid grid-cols-1 gap-x-7 gap-y-2 lg:grid-cols-2">
            {/* TITLE */}
            <FormInput label="Title" required icon={<FileText size={18} />}>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Enter title"
                className="pl-[58px] border border-gray-300 rounded-lg p-2 w-180 focus:outline-none focus:border-[#6366F1] focus:ring-[3px] focus:ring-[#6366F1]/20 transition-all duration-150"
                required
              />
            </FormInput>

            {/* TYPE */}
            <FormInput label="Type" required icon={<Newspaper size={18} />}>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="pl-[58px] border border-gray-300 rounded-lg p-2 w-180 focus:outline-none focus:border-[#6366F1] focus:ring-[3px] focus:ring-[#6366F1]/20 transition-all duration-150"
                required
              >
                <option value="News">News</option>
                <option value="Event">Event</option>
              </select>
            </FormInput>

            {/* CONTENT */}
            <div className="lg:col-span-2">
              <FormInput
                label="Content"
                required
                icon={<Pencil size={18} />}
                isTextarea
              >
                <textarea
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Write content here..."
                  className="pl-[58px] border border-gray-300 rounded-lg p-2 w-370 focus:outline-none focus:border-[#6366F1] focus:ring-[3px] focus:ring-[#6366F1]/20 transition-all duration-150"
                  required
                />
              </FormInput>
            </div>

            {/* DATE */}
            <FormInput
              label={
                <>
                  Event Date{" "}
                  <span className="font-normal">(if applicable)</span>
                </>
              }
              icon={<CalendarDays size={18} />}
            >
              <div className="relative">
                <input
                  type="date"
                  name="eventDate"
                  min={new Date().toISOString().split("T")[0]}
                  value={formData.eventDate}
                  onChange={handleChange}
                  // className="manage-input pl-[58px] pr-12"
                  className="pl-[58px] border border-gray-300 rounded-lg p-2 w-180 focus:outline-none focus:border-[#6366F1] focus:ring-[3px] focus:ring-[#6366F1]/20 transition-all duration-150"
                />

                {/* <CalendarDays
                  size={19}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#596b89]"
                /> */}
              </div>
            </FormInput>

            {/* TITLE IMAGE */}
            <div>
              <label className="mb-2 block text-[14px] font-semibold text-[#18305f] dark:text-slate-200">
                Title Image{" "}
                <span className="font-normal">(for index page)</span>
              </label>

              <input
                ref={titleImageRef}
                type="file"
                accept="image/*"
                onChange={handleTitleImage}
                // className="manage-file"
                className="pl-[58px] border border-gray-300 rounded-lg p-2 w-180 focus:outline-none focus:border-[#6366F1] focus:ring-[3px] focus:ring-[#6366F1]/20 transition-all duration-150"
              />

              <p className="mt-1 text-[12px] text-[#52678f] dark:text-slate-400">
                Recommended size: 1200 × 630 px
              </p>

              {isEdit && formData.titleImage && (
                <div className="mt-3">
                  <p className="mb-2 text-[13px] text-[#334a78] dark:text-slate-300">
                    Current image: {getFileName(formData.titleImage)}
                  </p>

                  <div className="relative w-fit">
                    <img
                      src={formData.titleImage}
                      alt="Current"
                      className="h-[108px] w-[305px] rounded-lg object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ADDITIONAL IMAGES */}
          <div className="mt-5">
            <label className="mb-2 block text-[14px] font-semibold text-[#18305f] dark:text-slate-200">
              Additional Images <span className="font-normal">(max 4)</span>
            </label>

            <input
              ref={additionalImagesRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleAdditionalImages}
              // className="manage-file"
              className="pl-[58px] border border-gray-300 rounded-lg p-2 w-180 focus:outline-none focus:border-[#6366F1] focus:ring-[3px] focus:ring-[#6366F1]/20 transition-all duration-150"
            />

            <p className="mt-1 text-[12px] text-[#52678f] dark:text-slate-400">
              Select up to 4 additional images to show in the detailed view.
            </p>
          </div>

          {/* EXISTING ADDITIONAL IMAGES */}
          {formData.additionalImages.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-3 text-[14px] font-semibold text-[#18305f] dark:text-slate-200">
                Existing Additional Images:
              </h3>

              <div className="flex flex-wrap gap-4">
                {formData.additionalImages.map((image, index) => (
                  <div key={`${image}-${index}`} className="group relative">
                    <img
                      src={image}
                      alt=""
                      className="h-[115px] w-[210px] rounded-lg border border-[#d9dfeb] dark:border-slate-600 object-cover"
                    />

                    <button
                      type="button"
                      onClick={() => removeAdditionalImage(index)}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                {formData.additionalImages.length < 4 && (
                  <label className="flex h-[115px] w-[195px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#bdc7dc] dark:border-slate-600 bg-white dark:bg-slate-700 text-center hover:bg-[#f8f9ff] dark:hover:bg-slate-600 transition-colors">
                    <CirclePlus
                      size={35}
                      className="mb-2 text-[#5d62e9] dark:text-blue-400"
                    />
                    <span className="text-sm text-[#334777] dark:text-slate-300">
                      Add more images
                    </span>
                    <span className="text-xs text-[#617197] dark:text-slate-400">
                      (Max 4)
                    </span>

                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleAdditionalImages}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* ACTIONS */}
          <div className="mt-5 flex justify-end gap-4 border-t border-[#edf0f5] dark:border-slate-700 pt-4 transition-colors">
            <button
              type="button"
              onClick={handleCancel}
              className="flex h-[46px] items-center gap-2 rounded-lg border border-[#d7deeb] dark:border-slate-600 bg-white dark:bg-slate-700 px-7 text-sm font-semibold text-[#344464] dark:text-slate-200 hover:bg-[#f8f9fc] dark:hover:bg-slate-600 transition-colors"
            >
              <X size={20} />
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-[46px] items-center gap-2 rounded-lg px-8 text-sm font-semibold text-white shadow-md hover:opacity-95 transition-opacity disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 size={19} className="animate-spin" />
              ) : (
                <Save size={19} />
              )}
              {isSubmitting ? "Updating..." : "Update News/Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* =============================================================
   FORM INPUT COMPONENT
============================================================= */

const FormInput = ({ label, required, icon, isTextarea, children }) => {
  return (
    <div className="w-full">
      <label className="mb-1.5 block text-[14px] font-semibold text-[#18305f] dark:text-slate-200">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <div className="relative">
        {icon && (
          <div
            className={`pointer-events-none absolute left-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-[#f0f2ff] dark:bg-slate-700 text-[#5560ee] dark:text-blue-400 transition-colors ${
              isTextarea ? "top-2.5" : "top-1/2 -translate-y-1/2"
            }`}
          >
            {icon}
          </div>
        )}

        {children}
      </div>
    </div>
  );
};

/* =============================================================
   HELPERS
============================================================= */

const formatDate = (date) => {
  if (!date) return "0000-00-00";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    return date;
  }
  return d.toISOString().split("T")[0];
};

const getFileName = (url) => {
  if (!url) return "";
  if (url.startsWith("data:")) return "Uploaded image";
  try {
    return url.split("/").pop().split("?")[0];
  } catch {
    return "image";
  }
};

export default ManageNewsEvents;
