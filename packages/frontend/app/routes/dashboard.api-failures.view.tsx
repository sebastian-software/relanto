/* eslint-disable @typescript-eslint/strict-boolean-expressions -- Display layer tolerates optional string fields. */
import type { ApiRequestFailure } from "@relanto/backend";

import { Form, Link } from "react-router";

import type { Locale } from "../lib/i18n";

import { t } from "../lib/i18n/tag";
import {
  buttonRow,
  control,
  emptyState,
  failuresTable,
  field,
  fieldLabel,
  filterForm,
  meta,
  primaryButton,
  reasonBadge,
  reasonMessage,
  secondaryButton,
  statusPill,
  tableCell,
  tableHead,
  tableHeaderCell,
  tableRow,
  tableWrap,
} from "./dashboard.api-failures.css";
import {
  formatDetails,
  formatTimestamp,
  getReasonLabel,
  type RawFilters,
  REASON_VALUES,
} from "./dashboard.api-failures.helpers";

export function FailureFilters({ filters }: { filters: RawFilters }): React.JSX.Element {
  return (
    <Form className={filterForm} method="get">
      <div className={field}>
        <label className={fieldLabel} htmlFor="filter-from">
          {t`From`}
        </label>
        <input
          className={control}
          defaultValue={filters.fromTimestamp}
          id="filter-from"
          name="from"
          placeholder="2026-06-01T00:00:00Z"
          type="text"
        />
      </div>

      <div className={field}>
        <label className={fieldLabel} htmlFor="filter-to">
          {t`To`}
        </label>
        <input
          className={control}
          defaultValue={filters.toTimestamp}
          id="filter-to"
          name="to"
          placeholder="2026-06-30T23:59:59Z"
          type="text"
        />
      </div>

      <div className={field}>
        <label className={fieldLabel} htmlFor="filter-status">
          {t`HTTP status`}
        </label>
        <input
          className={control}
          defaultValue={filters.httpStatus}
          id="filter-status"
          inputMode="numeric"
          name="httpStatus"
          placeholder="401"
          type="text"
        />
      </div>

      <div className={field}>
        <label className={fieldLabel} htmlFor="filter-reason">
          {t`Reason category`}
        </label>
        <select
          className={control}
          defaultValue={filters.reasonCategory}
          id="filter-reason"
          name="reasonCategory"
        >
          <option value="">{t`All reasons`}</option>
          {REASON_VALUES.map((reason) => (
            <option key={reason} value={reason}>
              {getReasonLabel(reason)}
            </option>
          ))}
        </select>
      </div>

      <div className={field}>
        <label className={fieldLabel} htmlFor="filter-application">
          {t`Application`}
        </label>
        <input
          className={control}
          defaultValue={filters.applicationId}
          id="filter-application"
          name="applicationId"
          placeholder="app_…"
          type="text"
        />
      </div>

      <div className={buttonRow}>
        <button className={primaryButton} type="submit">
          {t`Apply filters`}
        </button>
        <Link className={secondaryButton} to="/api-failures">
          {t`Reset`}
        </Link>
      </div>
    </Form>
  );
}

function FailureClientCell({ failure }: { failure: ApiRequestFailure }): React.JSX.Element {
  if (failure.clientId) {
    return (
      <>
        <div>{failure.clientId}</div>
        {failure.applicationId ? <div className={meta}>{failure.applicationId}</div> : null}
      </>
    );
  }

  if (failure.applicationId) {
    return <div>{failure.applicationId}</div>;
  }

  return <div className={meta}>{t`Anonymous`}</div>;
}

function FailureRow({
  failure,
  locale,
}: {
  failure: ApiRequestFailure;
  locale: Locale;
}): React.JSX.Element {
  const details = formatDetails(failure);

  return (
    <tr className={tableRow}>
      <td className={tableCell}>
        <div>{formatTimestamp(failure.createdAt, locale)}</div>
        <div className={meta}>{failure.createdAt}</div>
      </td>
      <td className={tableCell}>{failure.requestMethod}</td>
      <td className={tableCell}>{failure.requestPath}</td>
      <td className={tableCell}>
        <span className={statusPill}>{failure.httpStatus}</span>
      </td>
      <td className={tableCell}>
        <span className={reasonBadge}>{getReasonLabel(failure.reasonCategory)}</span>
      </td>
      <td className={tableCell}>
        <div className={reasonMessage}>{failure.reasonMessage}</div>
        {details ? <div className={meta}>{details}</div> : null}
      </td>
      <td className={tableCell}>
        <FailureClientCell failure={failure} />
      </td>
    </tr>
  );
}

export function FailureTable({
  failures,
  locale,
}: {
  failures: ApiRequestFailure[];
  locale: Locale;
}): React.JSX.Element {
  if (failures.length === 0) {
    return <div className={emptyState}>{t`No API failures match the selected filters.`}</div>;
  }

  return (
    <div className={tableWrap}>
      <table className={failuresTable}>
        <thead className={tableHead}>
          <tr>
            <th className={tableHeaderCell} scope="col">{t`Time`}</th>
            <th className={tableHeaderCell} scope="col">{t`Method`}</th>
            <th className={tableHeaderCell} scope="col">{t`Path`}</th>
            <th className={tableHeaderCell} scope="col">{t`Status`}</th>
            <th className={tableHeaderCell} scope="col">{t`Reason`}</th>
            <th className={tableHeaderCell} scope="col">{t`Message`}</th>
            <th className={tableHeaderCell} scope="col">{t`Client`}</th>
          </tr>
        </thead>
        <tbody>
          {failures.map((failure) => (
            <FailureRow failure={failure} key={failure.id} locale={locale} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
