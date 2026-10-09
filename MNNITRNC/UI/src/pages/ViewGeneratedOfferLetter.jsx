import { useState, useEffect } from "react";
import { useTheme } from "../layout/useTheme";
import {
  ChevronDown,
  Download,
  FileText,
  FileSearch,
  Info,
  Lightbulb,
} from "lucide-react";
import toast from 'react-hot-toast';
import {
  listProjects,
  getSanctionedManpowerPositions,
  getProject,
  listOfferLetters,
} from "../api/projectsApi";

export default function ViewGeneratedOfferLetters() {
  useTheme();
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");

  const [projects, setProjects] = useState([]);
  const [positions, setPositions] = useState([]);
  const [offerLetters, setOfferLetters] = useState([]);

  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [loadingLetters, setLoadingLetters] = useState(false);

  // Fetch projects list on mount
  useEffect(() => {
    let isMounted = true;
    setLoadingProjects(true);
    listProjects()
      .then((data) => {
        if (isMounted) {
          const rawList = Array.isArray(data)
            ? data
            : data?.items || data?.data || data?.projects || [];
          const uniqueMap = new Map();
          rawList.forEach((p) => {
            if (p && p.id) {
              if (!uniqueMap.has(p.id)) {
                uniqueMap.set(p.id, p);
              }
            }
          });
          setProjects(Array.from(uniqueMap.values()));
        }
      })
      .catch((err) => {
        console.error("Failed to load projects:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingProjects(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);
  // ----------------------------------------------------------
  // Project change
  // ----------------------------------------------------------

  const handleProjectChange = (e) => {
    const projectId = e.target.value;
    setSelectedProject(projectId);
    setSelectedPosition("");
    setPositions([]);
    setOfferLetters([]);

    if (projectId) {
      setLoadingPositions(true);
      getSanctionedManpowerPositions(projectId)
        .then((data) => {
          const rawPositions = Array.isArray(data)
            ? data
            : data?.sanctionedManpowerPositions ||
              data?.positions ||
              data?.data ||
              [];
          setPositions(rawPositions);
        })
        .catch((err) => {
          console.error(
            "Failed to fetch manpower positions, trying fallback getProject:",
            err
          );
          getProject(projectId)
            .then((p) => {
              const fallback =
                p?.sanctionedManpowerPositions || p?.positions || [];
              setPositions(fallback);
            })
            .catch((err2) => {
              console.error("Failed to fetch project details:", err2);
            });
        })
        .finally(() => {
          setLoadingPositions(false);
        });
    }
  };

  // Handle Position Change
  const handlePositionChange = (e) => {
    const posId = e.target.value;
    setSelectedPosition(posId);
    setOfferLetters([]);

    if (selectedProject && posId) {
      setLoadingLetters(true);
      listOfferLetters(selectedProject, posId)
        .then((data) => {
          const rawLetters = Array.isArray(data)
            ? data
            : data?.items || data?.data || data?.offerLetters || [];
          setOfferLetters(rawLetters);
        })
        .catch((err) => {
          console.error("Failed to fetch offer letters:", err);
        })
        .finally(() => {
          setLoadingLetters(false);
        });
    }
  };

  // Download Offer Letter handler
  const handleDownload = (letter) => {
    console.log("Download offer letter:", letter);
    if (letter.filePath) {
      window.open(letter.filePath, "_blank");
    } else {
      toast.success(`Downloading offer letter for candidate: ${letter.candidateName || letter.name || "Candidate"}`);
    }
  };

  // Current selected project object
  const currentProjectObj = projects.find(
    (p) => String(p.id) === String(selectedProject)
  );

  // Current selected position object
  const currentPositionObj = positions.find(
    (pos) => String(pos.id) === String(selectedPosition)
  );

  const selectedProjectSanctionNo = currentProjectObj
    ? currentProjectObj.sanctionNo ||
      currentProjectObj.sanctionNumber ||
      currentProjectObj.code ||
      currentProjectObj.projectTitle ||
      currentProjectObj.title ||
      selectedProject
    : "";

  const selectedPositionDesignation = currentPositionObj
    ? currentPositionObj.designation ||
      currentPositionObj.title ||
      currentPositionObj.name ||
      "Position"
    : "";

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 text-[#17294c] dark:text-slate-100 transition-colors duration-200 px-2 sm:px-4 lg:px-6 py-3">
      <div className="max-w-[1530px] ">
        {/* =====================================================
            PAGE HEADER
        ===================================================== */}

        <div className="flex items-center gap-4 mb-7 bg-white dark:bg-slate-800 rounded-lg border border-[#e4e8ee] dark:border-slate-700 shadow-[0_2px_8px_rgba(25,40,80,0.04)] px-4 sm:px-6 py-4 transition-colors duration-200">
          <div className="w-[50px] h-[50px] rounded-xl bg-[#f0f5ff] dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
            <FileSearch
              size={35}
              strokeWidth={1.8}
              className="text-[#1769e8] dark:text-blue-400"
            />
          </div>

          <div>
            <h1 className="text-[18px] sm:text-[20px] lg:text-[23px] font-extrabold text-[#102650] dark:text-slate-100 tracking-[-0.5px]">
              View Generated Offer Letters
            </h1>

            <p className="mt-0.5 text-[12px] sm:text-[13px] text-[#65728a] dark:text-slate-400">
              View and download generated manpower offer letters.
            </p>
          </div>
        </div>

        {/* =====================================================
            PROJECT / POSITION CARD
        ===================================================== */}

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-[#e4e8ee] dark:border-slate-700 shadow-[0_2px_8px_rgba(25,40,80,0.04)] px-4 sm:px-6 py-6 transition-colors duration-200">
          <div
            className={`grid grid-cols-1 ${
              selectedProject ? "md:grid-cols-2" : "md:grid-cols-1"
            } gap-6`}
          >
            {/* SELECT PROJECT */}
            <div>
              <label className="block text-[13px] font-semibold text-[#122b4c] dark:text-slate-200 mb-2">
                Select Project
              </label>

              <div className="relative">
                <select
                  value={selectedProject}
                  onChange={handleProjectChange}
                  className="appearance-none w-full h-[43px] rounded-md border border-[#ccd5e0] dark:border-slate-600 bg-white dark:bg-slate-700 px-4 pr-10 text-[14px] text-[#17283f] dark:text-slate-100 outline-none transition focus:border-[#1769e8] dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900"
                >
                  <option value="">
                    {loadingProjects ? "-- Loading Projects... --" : "-- Select Project --"}
                  </option>

                  {projects.map((project, index) => {
                    const sanction =
                      project.sanctionNo || project.sanctionNumber || project.code || "";
                    const title = project.projectTitle || project.title || project.name || "";
                    const label =
                      sanction && title
                        ? `${sanction} - ${title}`
                        : sanction || title || project.id;
                    return (
                      <option key={project.id ? `${project.id}-${index}` : index} value={project.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>

                <ChevronDown
                  size={17}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#17283f] dark:text-slate-400 pointer-events-none"
                />
              </div>
            </div>

            {/* SELECT MANPOWER POSITION */}
            {selectedProject && (
              <div>
                <label className="block text-[13px] font-semibold text-[#122b4c] dark:text-slate-200 mb-2">
                  Select Manpower Position
                </label>

                <div className="relative">
                  <select
                    value={selectedPosition}
                    onChange={handlePositionChange}
                    className="appearance-none w-full h-[43px] rounded-md border border-[#ccd5e0] dark:border-slate-600 bg-white dark:bg-slate-700 px-4 pr-10 text-[14px] text-[#17283f] dark:text-slate-100 outline-none transition focus:border-[#1769e8] dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900"
                  >
                    <option value="">
                      {loadingPositions ? "-- Loading Positions... --" : "-- Select Position --"}
                    </option>

                    {positions.map((position, index) => {
                      const designation =
                        position.designation ||
                        position.title ||
                        position.name ||
                        position.positionName ||
                        "Position";
                      const stipendNum = Number(position.stipend ?? position.stipendAmount ?? 0);
                      const hraNum = Number(position.hra ?? position.hraAmount ?? 0);
                      const stipendFormatted = stipendNum.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      });
                      const hraFormatted = hraNum.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      });
                      const label = `${designation} (Stipend: ₹${stipendFormatted} + HRA: ₹${hraFormatted})`;

                      return (
                        <option key={position.id ? `${position.id}-${index}` : index} value={position.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>

                  <ChevronDown
                    size={17}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#17283f] dark:text-slate-400 pointer-events-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STATE 1: NO PROJECT SELECTED */}
        {!selectedProject && (
          <div className="mt-7 min-h-[72px] rounded-md border border-[#9ec5ff] dark:border-blue-800 bg-[#eff6ff] dark:bg-slate-800 px-5 py-5 flex items-center justify-center text-center transition-colors duration-200">
            <div className="flex items-center gap-3">
              <Info
                size={20}
                strokeWidth={2}
                className="text-[#1769e8] dark:text-blue-400 flex-shrink-0"
              />
              <p className="text-[14px] text-[#1554d1] dark:text-blue-300">
                Please select a project to view its manpower positions and generated offer letters.
              </p>
            </div>
          </div>
        )}

        {/* STATE 2: PROJECT SELECTED BUT POSITION NOT SELECTED */}
        {selectedProject && !selectedPosition && (
          <div className="mt-7 min-h-[72px] rounded-md border border-[#9ec5ff] dark:border-blue-800 bg-[#eff6ff] dark:bg-slate-800 px-5 py-5 flex items-center justify-center text-center transition-colors duration-200">
            <div className="flex items-center gap-3">
              <Info
                size={20}
                strokeWidth={2}
                className="text-[#1769e8] dark:text-blue-400 flex-shrink-0"
              />
              <p className="text-[14px] text-[#1554d1] dark:text-blue-300">
                Please select a manpower position to view generated offer letters.
              </p>
            </div>
          </div>
        )}

        {/* STATE 3: POSITION SELECTED */}
        {selectedPosition && (
          <>
            {loadingLetters ? (
              <div className="mt-7 min-h-[72px] rounded-md border border-[#9ec5ff] dark:border-blue-800 bg-[#eff6ff] dark:bg-slate-800 px-5 py-5 flex items-center justify-center text-center">
                <p className="text-[14px] text-[#1554d1] dark:text-blue-300">
                  Loading generated offer letters...
                </p>
              </div>
            ) : offerLetters.length > 0 ? (
              <div className="mt-7 bg-white dark:bg-slate-800 rounded-lg border border-[#e4e8ee] dark:border-slate-700 shadow-[0_2px_8px_rgba(25,40,80,0.04)] p-4 sm:p-6 transition-colors duration-200">
                {/* =================================================
                    OFFER LETTERS EXIST
                ================================================= */}
                <h2 className="text-[17px] font-semibold text-[#102b4e] dark:text-slate-100 mb-5">
                  Generated Offer Letters
                </h2>

                <div className="space-y-3">
                  {offerLetters.map((letter, index) => {
                    const generatedOnFormatted = letter.generatedAt
                      ? new Date(letter.generatedAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        }).replace(",", "")
                      : letter.generatedOn || letter.joiningDate || "N/A";

                    return (
                      <div
                        key={letter.id ? `${letter.id}-${index}` : index}
                        className="border border-[#d9dee7] dark:border-slate-700 rounded-md p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-700 transition-colors duration-200"
                      >
                        {/* Letter Details */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <FileText
                              size={17}
                              strokeWidth={2}
                              className="text-[#1769e8] dark:text-blue-400"
                            />
                            <h3 className="text-[15px] font-semibold text-[#152942] dark:text-slate-100">
                              Offer Letter {index + 1} {letter.candidateName ? `- ${letter.candidateName}` : ''}
                            </h3>
                          </div>

                          <div className="space-y-1 text-[13px] text-[#40536e] dark:text-slate-400">
                            <p>
                              Generated on:{" "}
                              <span className="text-[#1769e8] dark:text-blue-400">
                                {generatedOnFormatted}
                              </span>
                            </p>

                            <p>
                              Position:{" "}
                              <span className="text-[#1769e8] dark:text-blue-400">
                                {selectedPositionDesignation || letter.position || letter.positionDesignation || "N/A"}
                              </span>
                            </p>

                            <p>
                              Project:{" "}
                              <span className="text-[#1769e8] dark:text-blue-400">
                                {selectedProjectSanctionNo || letter.project || letter.projectSanctionNo || "N/A"}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Download Button */}
                        <button
                          type="button"
                          onClick={() => handleDownload(letter)}
                          className="h-[38px] px-4 rounded-md bg-[#2864e8] hover:bg-[#1755d1] dark:bg-blue-600 dark:hover:bg-blue-700 active:bg-[#0f49bd] text-white text-[13px] font-semibold flex items-center justify-center gap-2 transition whitespace-nowrap"
                        >
                          <Download size={16} />
                          Download Offer Letter
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-7 min-h-[72px] rounded-md border border-[#f1d55a] dark:border-yellow-800 bg-[#fffde9] dark:bg-slate-800 px-5 py-5 flex items-center justify-center text-center transition-colors duration-200">
                <p className="text-[14px] text-[#b66a00] dark:text-yellow-600">
                  No offer letters have been generated for this manpower position yet.
                </p>
              </div>
            )}
          </>
        )}

        {/* INSTRUCTIONS */}
        <div className="mt-7 rounded-md border border-[#f0d44d] dark:border-yellow-800 bg-[#fffdea] dark:bg-slate-800 px-4 sm:px-6 py-5 transition-colors duration-200">
          <div className="flex gap-3">
            <div className="hidden sm:flex w-7 h-7 rounded-full items-center justify-center flex-shrink-0 text-[#e49a00] dark:text-yellow-600">
              <Lightbulb size={22} strokeWidth={2} />
            </div>

            <div className="flex-1">
              <h2 className="text-[15px] font-semibold text-[#874c00] dark:text-yellow-600 mb-3">
                Instructions:
              </h2>

              <ul className="list-disc pl-5 space-y-1.5 text-[13px] text-[#a25a00] dark:text-yellow-700">
                <li>Select a project to view available manpower positions</li>
                <li>
                  Choose a manpower position to see all generated offer letters for that position
                </li>
                <li>
                  Click "Download Offer Letter" to download the latest generated offer letter
                </li>
                <li>The most recent offer letter appears first in the list</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
