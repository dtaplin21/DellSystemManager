import SwiftUI
import PhotosUI

struct PhotoLibraryView: View {
    @Binding var image: UIImage?
    @Environment(\.presentationMode) var presentationMode
    @State private var selectedItem: PhotosPickerItem?
    
    var body: some View {
        NavigationView {
            PhotosPicker(selection: $selectedItem, matching: .images) {
                Text("Select Photo")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                    .padding()
            }
            .navigationTitle("Select Photo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            }
        }
        .onChange(of: selectedItem) { oldValue, newItem in
            Task {
                if let data = try? await newItem?.loadTransferable(type: Data.self),
                   let uiImage = UIImage(data: data) {
                    await MainActor.run {
                        image = uiImage
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            }
        }
    }
}

