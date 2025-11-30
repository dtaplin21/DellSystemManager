import SwiftUI

struct UploadResultsView: View {
    let result: UploadResult
    let project: Project
    @Binding var isPresented: Bool
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Success Icon
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 64))
                        .foregroundColor(.green)
                    
                    Text("Upload Successful")
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    // Defects Summary
                    if !result.defects.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Defects Detected: \(result.defects.count)")
                                .font(.headline)
                            
                            ForEach(result.defects) { defect in
                                DefectRowView(defect: defect)
                            }
                        }
                        .padding()
                        .background(Color.gray.opacity(0.1))
                        .cornerRadius(12)
                    } else {
                        Text("No defects detected")
                            .foregroundColor(.secondary)
                    }
                    
                    // Automation Status
                    if let status = result.automationStatus {
                        HStack {
                            Image(systemName: "checkmark.circle")
                                .foregroundColor(.green)
                            Text("Panel layout updated automatically")
                                .font(.caption)
                        }
                    }
                    
                    // Message
                    Text(result.message)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                    
                    Spacer()
                    
                    // Action Buttons
                    VStack(spacing: 12) {
                        Button(action: {
                            // Open web app URL
                            if let url = URL(string: "http://localhost:3000/dashboard/projects/\(project.id)/panel-layout") {
                                UIApplication.shared.open(url)
                            }
                        }) {
                            Text("View on Web App")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.blue)
                                .foregroundColor(.white)
                                .cornerRadius(12)
                        }
                        
                        Button(action: {
                            isPresented = false
                        }) {
                            Text("Upload Another")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.gray.opacity(0.2))
                                .foregroundColor(.primary)
                                .cornerRadius(12)
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Upload Results")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        isPresented = false
                    }
                }
            }
        }
    }
}

struct DefectRowView: View {
    let defect: Defect
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(defect.type.capitalized)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Spacer()
                SeverityBadge(severity: defect.severity)
            }
            Text(defect.description)
                .font(.caption)
                .foregroundColor(.secondary)
            Text("Location: \(defect.location)")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(8)
        .background(Color.white)
        .cornerRadius(8)
    }
}

struct SeverityBadge: View {
    let severity: String
    
    var color: Color {
        switch severity.lowercased() {
        case "severe":
            return .red
        case "moderate":
            return .orange
        case "minor":
            return .yellow
        default:
            return .gray
        }
    }
    
    var body: some View {
        Text(severity.capitalized)
            .font(.caption2)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.2))
            .foregroundColor(color)
            .cornerRadius(4)
    }
}

