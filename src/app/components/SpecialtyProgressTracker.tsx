import { Heart, Brain, Activity } from "lucide-react";
import { useNavigate } from "react-router";
import { draftManager } from "../utils/draftManager";

const specialtyIcons: Record<string, React.ReactNode> = {
  cardiology: <Heart className="w-5 h-5" />,
  neurology: <Brain className="w-5 h-5" />,
  oncology: <Activity className="w-5 h-5" />,
};

const specialtyNames: Record<string, string> = {
  cardiology: "Kardiologi",
  neurology: "Neurologi",
  oncology: "Onkologi",
};

const specialtyColors: Record<string, string> = {
  cardiology: "bg-red-500",
  neurology: "bg-blue-500",
  oncology: "bg-purple-500",
};

const stageLabels: Record<string, string> = {
  rsbk: "Hospital Structure Form",
  "clinical-audit": "Clinical Audit",
  "patient-report": "Patient Report",
  result: "Review & Submit",
};

export function SpecialtyProgressTracker({
  currentSpecialty,
  currentStage,
}: {
  currentSpecialty: string;
  currentStage: "rsbk" | "clinical-audit" | "patient-report" | "result";
}) {
  const navigate = useNavigate();

  // Get selected specialties from session
  const selectedSpecialtiesStr = sessionStorage.getItem("selectedSpecialties");
  const selectedSpecialties: string[] = selectedSpecialtiesStr
    ? JSON.parse(selectedSpecialtiesStr)
    : [currentSpecialty];

  const currentIndex = selectedSpecialties.indexOf(currentSpecialty);

  const stages = ["rsbk", "clinical-audit", "patient-report", "result"];
  const currentStageIndex = stages.indexOf(currentStage);

  const navigateToSpecialty = (spec: string, stage: string) => {
    if (stage === "rsbk") navigate(`/siap-persi/rsbk/${spec}`);
    else if (stage === "clinical-audit") navigate(`/siap-persi/clinical-audit/${spec}`);
    else if (stage === "patient-report") navigate(`/siap-persi/patient-report/${spec}`);
    else navigate(`/siap-persi/result/${spec}`);
  };

  return (
    <div className="bg-white rounded-xl border-2 border-[#0F4C81] p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Progress Multi-Pelayanan
          </h3>
          <p className="text-sm text-gray-600">
            {selectedSpecialties.length > 1
              ? `Pelayanan ${currentIndex + 1} dari ${selectedSpecialties.length}`
              : "1 pelayanan dipilih"}
          </p>
        </div>
        {selectedSpecialties.length > 1 && (
          <div className="text-right">
            <div className="text-3xl font-bold text-[#0F4C81]">
              {currentIndex + 1}/{selectedSpecialties.length}
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {selectedSpecialties.length > 1 && (
        <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
          <div
            className="bg-gradient-to-r from-[#0F4C81] to-[#14B8A6] h-3 rounded-full transition-all duration-500"
            style={{
              width: `${((currentIndex + 1) / selectedSpecialties.length) * 100}%`,
            }}
          />
        </div>
      )}

      {/* Specialty Navigation */}
      <div className="flex flex-wrap gap-2 mb-4">
        {selectedSpecialties.map((spec, index) => {
          const isCurrent = spec === currentSpecialty;

          return (
            <button
              key={spec}
              onClick={() => navigateToSpecialty(spec, currentStage)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                isCurrent
                  ? `${specialtyColors[spec]} border-transparent text-white font-semibold`
                  : "bg-gray-50 border-gray-300 text-gray-600 hover:border-[#0F4C81] hover:bg-blue-50"
              }`}
              title={`Pindah ke ${specialtyNames[spec]}`}
            >
              {specialtyIcons[spec]}
              <span className="text-sm font-medium">{specialtyNames[spec]}</span>
            </button>
          );
        })}
      </div>

      {/* Stage Navigation (within same specialty) */}
      <div className="flex gap-2 mb-3">
        {stages.map((stage, idx) => {
          const isCurrent = stage === currentStage;
          
          // Determine completion and proportion
          const draftId = draftManager.getCurrentDraftId();
          const draft = draftId ? draftManager.getDraftById(draftId) : null;
          const progress = draft?.progress[currentSpecialty];
          
          let isCompleted = false;
          let proportion = 0; // 0 to 1

          if (stage === "rsbk") {
            isCompleted = progress?.rsbk?.completed || false;
            proportion = isCompleted ? 1 : (Object.keys(progress?.rsbk?.data || {}).length > 0 ? 0.5 : 0);
          } else if (stage === "clinical-audit") {
            isCompleted = progress?.clinicalAudit?.completed || false;
            proportion = isCompleted ? 1 : ((progress?.clinicalAudit?.currentPatient || 0) / 30);
          } else if (stage === "patient-report") {
            isCompleted = progress?.patientReport?.completed || false;
            const pmcount = progress?.patientReport?.patientCount || 0;
            // sometimes it's saved as 30 but completed=false if not submitted yet
            proportion = isCompleted ? 1 : (pmcount / 30);
          } else if (stage === "result") {
            isCompleted = !!(progress?.rsbk?.completed && progress?.clinicalAudit?.completed && progress?.patientReport?.completed);
          }

          let buttonClasses = `flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer relative overflow-hidden flex items-center justify-center `;
          let inlineStyle: React.CSSProperties = {};

          if (isCurrent) {
            buttonClasses += "bg-[#0F4C81] text-white shadow-md border-2 border-transparent scale-[1.02] z-10";
          } else if (isCompleted) {
            buttonClasses += "bg-green-100 text-green-700 hover:bg-green-200 border-2 border-transparent";
          } else if (proportion > 0) {
            buttonClasses += "text-yellow-800 border-2 border-yellow-300 hover:border-yellow-400";
            // Use local CSS gradient to serve as progress bar background
            inlineStyle = {
              background: `linear-gradient(to right, #fef08a ${proportion * 100}%, #f9fafb ${proportion * 100}%)`,
            };
          } else {
            buttonClasses += "bg-gray-50 text-gray-400 hover:bg-gray-100 border-2 border-gray-100 hover:text-gray-600";
          }

          return (
            <button
              key={stage}
              onClick={() => navigateToSpecialty(currentSpecialty, stage)}
              className={buttonClasses}
              style={inlineStyle}
              title={stageLabels[stage]}
            >
              <span className="relative z-10 flex items-center gap-1.5 text-center leading-tight">
                {isCompleted && !isCurrent && "✓"} {stageLabels[stage]}
                {!isCompleted && proportion > 0 && !isCurrent && `(${(proportion * 100).toFixed(0)}%)`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Current Stage Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-gray-700">
          <strong>Sedang mengisi:</strong> {specialtyNames[currentSpecialty]} -{" "}
          {stageLabels[currentStage]}
          {selectedSpecialties.length > 1 && (
            <span className="text-gray-500 ml-2">
              (Klik pelayanan lain untuk pindah)
            </span>
          )}
        </p>
      </div>
    </div>
  );
}