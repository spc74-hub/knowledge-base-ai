"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

// Hardcoded API URL - always use HTTPS in production
const API_URL = 'https://knowledge-base-ai-production.up.railway.app';

interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

interface NewAPIKey {
  id: string;
  name: string;
  key: string;
  key_prefix: string;
  message: string;
}

export default function APIKeysPage() {
  const { user, token } = useAuth();
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [newKey, setNewKey] = useState<NewAPIKey | null>(null);
  const [keyName, setKeyName] = useState("iOS Shortcut");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (token) {
      loadKeys();
    }
  }, [token]);

  const loadKeys = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/api-keys/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
      }
    } catch (error) {
      console.error("Error loading keys:", error);
    } finally {
      setLoading(false);
    }
  };

  const createKey = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/api-keys/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: keyName }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewKey(data);
        setKeyName("iOS Shortcut");
        loadKeys();
      } else {
        const error = await res.json();
        alert(error.detail || "Error creating API key");
      }
    } catch (error) {
      console.error("Error creating key:", error);
      alert("Error creating API key");
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (keyId: string) => {
    if (!confirm("¿Seguro que quieres revocar esta API key? Esta acción no se puede deshacer.")) {
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/v1/api-keys/${keyId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        loadKeys();
      }
    } catch (error) {
      console.error("Error revoking key:", error);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem" }}>
        <p>Por favor, inicia sesión para gestionar tus API keys.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ fontSize: "1.875rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
        API Keys
      </h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        Genera API keys permanentes para usar con iOS Shortcuts, bookmarklets y otras integraciones.
        Las API keys no expiran y funcionan indefinidamente.
      </p>

      {/* New Key Created */}
      {newKey && (
        <div style={{
          marginBottom: "2rem",
          padding: "1.5rem",
          border: "2px solid #22c55e",
          borderRadius: "8px",
          backgroundColor: "#f0fdf4"
        }}>
          <h2 style={{ color: "#166534", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            🔑 ¡API Key Creada!
          </h2>
          <p style={{ color: "#166534", marginBottom: "1rem" }}>
            Guarda esta clave ahora. No se volverá a mostrar.
          </p>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem",
            backgroundColor: "white",
            borderRadius: "6px",
            border: "1px solid #e5e7eb"
          }}>
            <code style={{ flex: 1, fontSize: "0.875rem", fontFamily: "monospace", wordBreak: "break-all" }}>
              {showKey ? newKey.key : "•".repeat(newKey.key.length)}
            </code>
            <button
              onClick={() => setShowKey(!showKey)}
              style={{
                padding: "0.5rem",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: "1rem"
              }}
              title={showKey ? "Ocultar" : "Mostrar"}
            >
              {showKey ? "👁️‍🗨️" : "👁️"}
            </button>
            <button
              onClick={() => copyToClipboard(newKey.key)}
              style={{
                padding: "0.5rem",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: "1rem"
              }}
              title="Copiar"
            >
              {copied ? "✅" : "📋"}
            </button>
          </div>
          <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.75rem" }}>
            Usa esta clave en el header{" "}
            <code style={{ backgroundColor: "#f3f4f6", padding: "0.125rem 0.25rem", borderRadius: "3px" }}>
              Authorization: Bearer {newKey.key_prefix}...
            </code>{" "}
            o{" "}
            <code style={{ backgroundColor: "#f3f4f6", padding: "0.125rem 0.25rem", borderRadius: "3px" }}>
              X-API-Key: {newKey.key_prefix}...
            </code>
          </p>
          <button
            onClick={() => setNewKey(null)}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              backgroundColor: "white",
              cursor: "pointer"
            }}
          >
            Entendido, ya la guardé
          </button>
        </div>
      )}

      {/* Create New Key */}
      <div style={{
        marginBottom: "2rem",
        padding: "1.5rem",
        border: "1px solid #e5e7eb",
        borderRadius: "8px"
      }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "0.25rem" }}>
          Crear Nueva API Key
        </h2>
        <p style={{ color: "#666", marginBottom: "1rem", fontSize: "0.875rem" }}>
          Crea una nueva clave para tus integraciones. Máximo 5 claves activas.
        </p>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <input
            type="text"
            placeholder="Nombre de la clave (ej: iOS Shortcut)"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            style={{
              padding: "0.5rem 0.75rem",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              width: "300px"
            }}
          />
          <button
            onClick={createKey}
            disabled={creating || !keyName}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: creating ? "#9ca3af" : "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: creating ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem"
            }}
          >
            ➕ {creating ? "Creando..." : "Crear API Key"}
          </button>
        </div>
      </div>

      {/* Existing Keys */}
      <div style={{
        padding: "1.5rem",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        marginBottom: "2rem"
      }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "0.25rem" }}>
          Tus API Keys
        </h2>
        <p style={{ color: "#666", marginBottom: "1rem", fontSize: "0.875rem" }}>
          Gestiona tus claves existentes. Las claves revocadas dejan de funcionar inmediatamente.
        </p>

        {loading ? (
          <p style={{ color: "#666" }}>Cargando...</p>
        ) : keys.length === 0 ? (
          <p style={{ color: "#666" }}>No tienes API keys. Crea una para empezar.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {keys.map((key) => (
              <div
                key={key.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px"
                }}
              >
                <div>
                  <div style={{ fontWeight: "500" }}>{key.name}</div>
                  <div style={{ fontSize: "0.875rem", color: "#666" }}>
                    <code>{key.key_prefix}...</code> · Creada el{" "}
                    {new Date(key.created_at).toLocaleDateString("es-ES")}
                    {key.last_used_at && (
                      <> · Último uso: {new Date(key.last_used_at).toLocaleDateString("es-ES")}</>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {key.is_active ? (
                    <span style={{
                      fontSize: "0.75rem",
                      backgroundColor: "#dcfce7",
                      color: "#166534",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "9999px"
                    }}>
                      Activa
                    </span>
                  ) : (
                    <span style={{
                      fontSize: "0.75rem",
                      backgroundColor: "#fee2e2",
                      color: "#991b1b",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "9999px"
                    }}>
                      Revocada
                    </span>
                  )}
                  {key.is_active && (
                    <button
                      onClick={() => revokeKey(key.id)}
                      style={{
                        padding: "0.5rem",
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        color: "#ef4444"
                      }}
                      title="Revocar"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={{
        padding: "1.5rem",
        border: "1px solid #e5e7eb",
        borderRadius: "8px"
      }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1rem" }}>
          Cómo usar tu API Key
        </h2>
        <div style={{ marginBottom: "1rem" }}>
          <h4 style={{ fontWeight: "500", marginBottom: "0.5rem" }}>iOS/macOS Shortcut</h4>
          <p style={{ fontSize: "0.875rem", color: "#666" }}>
            En tu Shortcut, cambia el header de autorización a:
          </p>
          <code style={{
            display: "block",
            backgroundColor: "#f3f4f6",
            padding: "0.5rem",
            borderRadius: "6px",
            marginTop: "0.5rem",
            fontSize: "0.875rem"
          }}>
            Authorization: Bearer kb_xxxxxxxx...
          </code>
        </div>
        <div>
          <h4 style={{ fontWeight: "500", marginBottom: "0.5rem" }}>cURL</h4>
          <pre style={{
            backgroundColor: "#f3f4f6",
            padding: "0.75rem",
            borderRadius: "6px",
            fontSize: "0.875rem",
            overflow: "auto"
          }}>
{`curl -X POST "${API_URL}/api/v1/quick-save/shortcut?url=https://example.com" \\
  -H "Authorization: Bearer kb_tu_api_key_aqui"`}
          </pre>
        </div>
      </div>
    </div>
  );
}
