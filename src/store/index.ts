import { configureStore } from '@reduxjs/toolkit'
import { PeerReducer } from "./peer/peerReducer";
import { ConnectionReducer } from "./connection/connectionReducer";
import { ChatReducer } from "./chat/chatReducer";
import { FileReducer } from "./file/fileReducer";
import { SettingsReducer } from "./settings/settingsReducer";

export const store = configureStore({
    reducer: {
        peer: PeerReducer,
        connection: ConnectionReducer,
        chat: ChatReducer,
        file: FileReducer,
        settings: SettingsReducer,
    }
})

window.store = store

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
