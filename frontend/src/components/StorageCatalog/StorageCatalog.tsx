import { ExternalLink, FileImage, Layers, RefreshCw } from "lucide-react";
import { toApiUrl } from "../../services/api";
import type { ArtifactRecord, GisLayer } from "../../types/api";
import styles from "./StorageCatalog.module.css";

export function StorageCatalog(props: {
  gisLayers: GisLayer[];
  quicklookArtifact: ArtifactRecord | null;
  storageMessage: string;
  onRefresh: () => void;
}) {
  return (
    <section className={styles.storageGrid} id="storage" aria-label="Artifact and GIS storage">
      <article className={`${styles.panel} ${styles.artifactPanel}`}>
        <div className={styles.panelHeading}>
          <h2>Latest Model Artifact</h2>
          <button className={styles.iconButton} type="button" onClick={props.onRefresh} aria-label="Refresh storage APIs">
            <RefreshCw aria-hidden="true" />
          </button>
        </div>
        {props.quicklookArtifact ? (
          <>
            <img
              className={styles.quicklook}
              src={toApiUrl(props.quicklookArtifact.artifact_url)}
              alt="Latest nowcast quicklook"
            />
            <a className={styles.artifactLink} href={toApiUrl(props.quicklookArtifact.artifact_url)} target="_blank" rel="noreferrer">
              <FileImage aria-hidden="true" />
              <span>{props.quicklookArtifact.filename}</span>
              <ExternalLink aria-hidden="true" />
            </a>
          </>
        ) : (
          <div className={styles.artifactEmpty}>
            <FileImage aria-hidden="true" />
            <span>No registered quicklook yet</span>
          </div>
        )}
        <p className={styles.muted}>{props.storageMessage}</p>
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHeading}>
          <h2>GIS Layer Catalog</h2>
          <Layers aria-hidden="true" className={styles.headingIcon} />
        </div>
        <ul className={styles.layerList}>
          {props.gisLayers.slice(0, 8).map((layer) => (
            <li key={layer.layer_id}>
              <div>
                <strong>{layer.label}</strong>
                <span>{layer.group}</span>
              </div>
              <a href={toApiUrl(layer.data_url)} target="_blank" rel="noreferrer">
                {layer.feature_count ?? "--"} features
              </a>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
