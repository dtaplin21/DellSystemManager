import Foundation

// MARK: - Form Type Enum
enum AsbuiltFormType: String, Codable, CaseIterable, Identifiable {
    case panelPlacement = "panel_placement"
    case panelSeaming = "panel_seaming"
    case nonDestructive = "non_destructive"
    case trialWeld = "trial_weld"
    case repairs = "repairs"
    case destructive = "destructive"
    
    var id: String { rawValue }
    
    var displayName: String {
        switch self {
        case .panelPlacement: return "Panel Placement"
        case .panelSeaming: return "Panel Seaming"
        case .nonDestructive: return "Non-Destructive Testing"
        case .trialWeld: return "Trial Weld"
        case .repairs: return "Repairs"
        case .destructive: return "Destructive Testing"
        }
    }
    
    var description: String {
        switch self {
        case .panelPlacement: return "Panel positioning and installation data"
        case .panelSeaming: return "Seam welding and joining data"
        case .nonDestructive: return "NDT inspection and testing data"
        case .trialWeld: return "Trial welding test and validation data"
        case .repairs: return "Panel repair and maintenance data"
        case .destructive: return "Destructive testing and analysis data"
        }
    }
    
    var icon: String {
        switch self {
        case .panelPlacement: return "location.fill"
        case .panelSeaming: return "link"
        case .nonDestructive: return "magnifyingglass"
        case .trialWeld: return "bolt.fill"
        case .repairs: return "wrench.and.screwdriver.fill"
        case .destructive: return "flask.fill"
        }
    }
    
    var color: String {
        switch self {
        case .panelPlacement: return "blue"
        case .panelSeaming: return "green"
        case .nonDestructive: return "orange"
        case .trialWeld: return "purple"
        case .repairs: return "red"
        case .destructive: return "gray"
        }
    }
}

// MARK: - Form Field Type
enum FormFieldType: String, Codable {
    case text
    case number
    case date
    case datetime
    case textarea
    case select
}

// MARK: - Form Field Configuration
struct AsbuiltFormField: Identifiable {
    let id = UUID()
    let key: String
    let label: String
    let type: FormFieldType
    let required: Bool
    let options: [String]?
    
    init(key: String, label: String, type: FormFieldType, required: Bool = false, options: [String]? = nil) {
        self.key = key
        self.label = label
        self.type = type
        self.required = required
        self.options = options
    }
}

// MARK: - Form Configuration
struct AsbuiltFormConfig {
    static func getFields(for formType: AsbuiltFormType) -> [AsbuiltFormField] {
        switch formType {
        case .panelPlacement:
            return [
                AsbuiltFormField(key: "dateTime", label: "Date & Time", type: .datetime, required: true),
                AsbuiltFormField(key: "panelNumber", label: "Panel Number", type: .text, required: true),
                AsbuiltFormField(key: "locationDescription", label: "Location Description", type: .textarea, required: true),
                AsbuiltFormField(key: "locationNote", label: "Location Note", type: .textarea, required: false),
                AsbuiltFormField(key: "weatherComments", label: "Weather Comments", type: .textarea, required: false)
            ]
            
        case .panelSeaming:
            return [
                AsbuiltFormField(key: "dateTime", label: "Date & Time", type: .datetime, required: true),
                AsbuiltFormField(key: "panelNumbers", label: "Panel Numbers", type: .text, required: true),
                AsbuiltFormField(key: "seamLength", label: "Seam Length (ft)", type: .number, required: false),
                AsbuiltFormField(key: "seamerInitials", label: "Seamer Initials", type: .text, required: true),
                AsbuiltFormField(key: "machineNumber", label: "Machine Number", type: .text, required: false),
                AsbuiltFormField(key: "wedgeTemp", label: "Wedge Temperature (°F)", type: .number, required: false),
                AsbuiltFormField(key: "nipRollerSpeed", label: "Nip Roller Speed", type: .text, required: false),
                AsbuiltFormField(key: "barrelTemp", label: "Barrel Temperature (°F)", type: .number, required: false),
                AsbuiltFormField(key: "preheatTemp", label: "Preheat Temperature (°F)", type: .number, required: false),
                AsbuiltFormField(key: "trackPeelInside", label: "Track Peel Inside", type: .number, required: false),
                AsbuiltFormField(key: "trackPeelOutside", label: "Track Peel Outside", type: .number, required: false),
                AsbuiltFormField(key: "tensileLbsPerIn", label: "Tensile (lbs/in)", type: .number, required: false),
                AsbuiltFormField(key: "tensileRate", label: "Tensile Rate", type: .text, required: false),
                AsbuiltFormField(key: "vboxPassFail", label: "VBox Result", type: .select, required: true, options: ["Pass", "Fail", "N/A"]),
                AsbuiltFormField(key: "weatherComments", label: "Weather Comments", type: .textarea, required: false)
            ]
            
        case .nonDestructive:
            return [
                AsbuiltFormField(key: "dateTime", label: "Date & Time", type: .datetime, required: true),
                AsbuiltFormField(key: "panelNumbers", label: "Panel Numbers", type: .text, required: true),
                AsbuiltFormField(key: "operatorInitials", label: "Operator Initials", type: .text, required: true),
                AsbuiltFormField(key: "vboxPassFail", label: "VBox Result", type: .select, required: true, options: ["Pass", "Fail"]),
                AsbuiltFormField(key: "notes", label: "Notes", type: .textarea, required: false)
            ]
            
        case .trialWeld:
            return [
                AsbuiltFormField(key: "dateTime", label: "Date & Time", type: .datetime, required: true),
                AsbuiltFormField(key: "seamerInitials", label: "Seamer Initials", type: .text, required: true),
                AsbuiltFormField(key: "machineNumber", label: "Machine Number", type: .text, required: false),
                AsbuiltFormField(key: "wedgeTemp", label: "Wedge Temperature (°F)", type: .number, required: false),
                AsbuiltFormField(key: "nipRollerSpeed", label: "Nip Roller Speed", type: .text, required: false),
                AsbuiltFormField(key: "barrelTemp", label: "Barrel Temperature (°F)", type: .number, required: false),
                AsbuiltFormField(key: "preheatTemp", label: "Preheat Temperature (°F)", type: .number, required: false),
                AsbuiltFormField(key: "trackPeelInside", label: "Track Peel Inside", type: .number, required: false),
                AsbuiltFormField(key: "trackPeelOutside", label: "Track Peel Outside", type: .number, required: false),
                AsbuiltFormField(key: "tensileLbsPerIn", label: "Tensile (lbs/in)", type: .number, required: false),
                AsbuiltFormField(key: "tensileRate", label: "Tensile Rate", type: .text, required: false),
                AsbuiltFormField(key: "passFail", label: "Result", type: .select, required: true, options: ["Pass", "Fail"]),
                AsbuiltFormField(key: "ambientTemp", label: "Ambient Temperature (°F)", type: .number, required: false),
                AsbuiltFormField(key: "comments", label: "Comments", type: .textarea, required: false)
            ]
            
        case .repairs:
            return [
                AsbuiltFormField(key: "date", label: "Date", type: .date, required: true),
                AsbuiltFormField(key: "repairId", label: "Repair ID", type: .text, required: true),
                AsbuiltFormField(key: "panelNumbers", label: "Panel Numbers", type: .text, required: true),
                AsbuiltFormField(key: "placementType", label: "Placement Type", type: .select, required: true, options: ["Single Panel", "Seam Between Panels"]),
                AsbuiltFormField(key: "locationDistance", label: "Distance (feet)", type: .number, required: true),
                AsbuiltFormField(key: "locationDirection", label: "Direction from North", type: .select, required: true, options: ["North", "South", "East", "West"]),
                AsbuiltFormField(key: "locationDescription", label: "Location Description", type: .textarea, required: false),
                AsbuiltFormField(key: "extruderNumber", label: "Extruder Number", type: .text, required: false),
                AsbuiltFormField(key: "operatorInitials", label: "Operator Initials", type: .text, required: false),
                AsbuiltFormField(key: "typeDetailLocation", label: "Type/Detail/Location", type: .textarea, required: false),
                AsbuiltFormField(key: "vboxPassFail", label: "VBox Result", type: .select, required: false, options: ["Pass", "Fail"])
            ]
            
        case .destructive:
            return [
                AsbuiltFormField(key: "date", label: "Date", type: .date, required: true),
                AsbuiltFormField(key: "panelNumbers", label: "Panel Numbers", type: .text, required: true),
                AsbuiltFormField(key: "sampleId", label: "Sample ID", type: .text, required: true),
                AsbuiltFormField(key: "testerInitials", label: "Tester Initials", type: .text, required: false),
                AsbuiltFormField(key: "machineNumber", label: "Machine Number", type: .text, required: false),
                AsbuiltFormField(key: "trackPeelInside", label: "Track Peel Inside", type: .number, required: false),
                AsbuiltFormField(key: "trackPeelOutside", label: "Track Peel Outside", type: .number, required: false),
                AsbuiltFormField(key: "tensileLbsPerIn", label: "Tensile (lbs/in)", type: .number, required: false),
                AsbuiltFormField(key: "tensileRate", label: "Tensile Rate", type: .text, required: false),
                AsbuiltFormField(key: "passFail", label: "Result", type: .select, required: true, options: ["Pass", "Fail"]),
                AsbuiltFormField(key: "comments", label: "Comments", type: .textarea, required: false)
            ]
        }
    }
}

// MARK: - Form Data
typealias AsbuiltFormData = [String: Any]

