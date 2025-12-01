//
//  QC_APPApp.swift
//  QC APP
//
//  Created by Dominique Taplin on 11/29/25.
//

import SwiftUI
import SwiftData


@main
struct QC_APPApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: UploadQueueItem.self)
    }
}

//@main
//struct QC_APPApp: App {
//    let persistenceController = PersistenceController.shared
//
//    var body: some Scene {
//        WindowGroup {
//            ContentView()
//                .environment(\.managedObjectContext, persistenceController.container.viewContext)
//        }
//    }
//}
