import SwiftUI

struct FormTypeSelectionView: View {
    let project: Project
    @Binding var selectedFormType: AsbuiltFormType?
    @Binding var isPresented: Bool
    
    let columns = [
        GridItem(.flexible()),
        GridItem(.flexible())
    ]
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Project Header
                    VStack(spacing: 8) {
                        Text(project.name)
                            .font(.title2)
                            .fontWeight(.bold)
                        if let location = project.location {
                            Text(location)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.top)
                    
                    Text("Select Form Type")
                        .font(.headline)
                        .foregroundColor(.secondary)
                        .padding(.top, 8)
                    
                    // Form Type Grid
                    LazyVGrid(columns: columns, spacing: 16) {
                        ForEach(AsbuiltFormType.allCases) { formType in
                            FormTypeCard(
                                formType: formType,
                                isSelected: selectedFormType == formType
                            ) {
                                selectedFormType = formType
                            }
                        }
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical)
            }
            .navigationTitle("New Entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        isPresented = false
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Next") {
                        // Next button will be handled by parent
                    }
                    .disabled(selectedFormType == nil)
                }
            }
        }
    }
}

struct FormTypeCard: View {
    let formType: AsbuiltFormType
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 12) {
                // Icon
                Image(systemName: formType.icon)
                    .font(.system(size: 32))
                    .foregroundColor(colorForFormType(formType))
                
                // Title
                Text(formType.displayName)
                    .font(.headline)
                    .foregroundColor(.primary)
                    .multilineTextAlignment(.center)
                
                // Description
                Text(formType.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isSelected ? colorForFormType(formType).opacity(0.1) : Color(.systemGray6))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? colorForFormType(formType) : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private func colorForFormType(_ formType: AsbuiltFormType) -> Color {
        switch formType {
        case .panelPlacement: return .blue
        case .panelSeaming: return .green
        case .nonDestructive: return .orange
        case .trialWeld: return .purple
        case .repairs: return .red
        case .destructive: return .gray
        }
    }
}

