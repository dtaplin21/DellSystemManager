import Foundation
import SwiftData
import Network

@MainActor
class OfflineQueueService: ObservableObject {
    static let shared = OfflineQueueService()
    
    @Published var isOnline = true
    @Published var queueCount = 0
    @Published var isProcessing = false
    
    private var modelContainer: ModelContainer?
    private var modelContext: ModelContext?
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")
    private let apiClient = APIClient.shared
    private let uploadService = ImageUploadService.shared
    
    private init() {
        setupSwiftData()
        startNetworkMonitoring()
    }
    
    private func setupSwiftData() {
        do {
            let schema = Schema([UploadQueueItem.self])
            let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
            modelContainer = try ModelContainer(for: schema, configurations: [configuration])
            if let container = modelContainer {
                modelContext = ModelContext(container)
            }
            loadQueueCount()
        } catch {
            print("Failed to setup SwiftData: \(error)")
        }
    }
    
    private func startNetworkMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.isOnline = path.status == .satisfied
                if self?.isOnline == true {
                    await self?.processQueue()
                }
            }
        }
        monitor.start(queue: queue)
    }
    
    func addToQueue(
        projectId: String,
        image: Data,
        imageName: String,
        metadata: DefectMetadata?
    ) {
        guard let context = modelContext else { return }
        
        let queueItem = UploadQueueItem(
            projectId: projectId,
            imageData: image,
            imageName: imageName,
            location: metadata?.location,
            notes: metadata?.notes,
            defectType: metadata?.defectType,
            latitude: metadata?.latitude,
            longitude: metadata?.longitude
        )
        
        context.insert(queueItem)
        
        do {
            try context.save()
            loadQueueCount()
            
            // Try to process immediately if online
            if isOnline {
                Task {
                    await processQueue()
                }
            }
        } catch {
            print("Failed to save to queue: \(error)")
        }
    }
    
    func processQueue() async {
        guard isOnline, !isProcessing, let context = modelContext else { return }
        
        isProcessing = true
        
        let descriptor = FetchDescriptor<UploadQueueItem>(
            predicate: #Predicate { $0.status == "pending" || $0.status == "failed" },
            sortBy: [SortDescriptor(\.createdAt)]
        )
        
        do {
            let items = try context.fetch(descriptor)
            
            for item in items {
                // Skip if retry count is too high
                if item.retryCount >= 3 {
                    item.status = "failed"
                    item.lastError = "Max retries exceeded"
                    continue
                }
                
                item.status = "uploading"
                item.retryCount += 1
                item.updatedAt = Date()
                
                try context.save()
                
                // Convert Data to UIImage
                guard let image = UIImage(data: item.imageData) else {
                    item.status = "failed"
                    item.lastError = "Invalid image data"
                    try context.save()
                    continue
                }
                
                // Create metadata
                let metadata = DefectMetadata(
                    location: item.location,
                    notes: item.notes,
                    defectType: item.defectType,
                    latitude: item.latitude,
                    longitude: item.longitude
                )
                
                // Attempt upload
                do {
                    _ = try await uploadService.uploadDefectPhoto(
                        image: image,
                        projectId: item.projectId,
                        metadata: metadata
                    )
                    
                    // Success - remove from queue
                    context.delete(item)
                    try context.save()
                    
                } catch {
                    // Failed - mark for retry
                    item.status = "failed"
                    item.lastError = error.localizedDescription
                    try context.save()
                }
            }
            
            loadQueueCount()
        } catch {
            print("Failed to process queue: \(error)")
        }
        
        isProcessing = false
    }
    
    func getQueueItems() -> [UploadQueueItem] {
        guard let context = modelContext else { return [] }
        
        let descriptor = FetchDescriptor<UploadQueueItem>(
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )
        
        do {
            return try context.fetch(descriptor)
        } catch {
            return []
        }
    }
    
    func clearCompleted() {
        guard let context = modelContext else { return }
        
        let descriptor = FetchDescriptor<UploadQueueItem>(
            predicate: #Predicate { $0.status == "completed" }
        )
        
        do {
            let items = try context.fetch(descriptor)
            for item in items {
                context.delete(item)
            }
            try context.save()
            loadQueueCount()
        } catch {
            print("Failed to clear completed: \(error)")
        }
    }
    
    private func loadQueueCount() {
        guard let context = modelContext else { return }
        
        let descriptor = FetchDescriptor<UploadQueueItem>(
            predicate: #Predicate { $0.status == "pending" || $0.status == "failed" }
        )
        
        do {
            let items = try context.fetch(descriptor)
            queueCount = items.count
        } catch {
            queueCount = 0
        }
    }
}

