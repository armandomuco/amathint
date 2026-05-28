import type { TranslationCopy } from "../i18n";

const ALL_GRADES = Array.from({ length: 12 }, (_, index) => index + 1);

export function StudentGradeSelect({
  copy,
  value,
  grades = ALL_GRADES,
  onChange
}: {
  copy: TranslationCopy;
  value: number | null;
  grades?: number[];
  onChange: (grade: number) => void;
}) {
  return (
    <div className="grade-picker">
      <span>{copy.studentGrade}</span>
      <div>
        {grades.map((grade) => (
          <button className={value === grade ? "active" : ""} key={grade} onClick={() => onChange(grade)} type="button">
            {grade}
          </button>
        ))}
      </div>
      <small>{copy.chooseClass}</small>
    </div>
  );
}

export function TeacherGradeMultiSelect({
  copy,
  values,
  grades = ALL_GRADES,
  onChange
}: {
  copy: TranslationCopy;
  values: number[];
  grades?: number[];
  onChange: (grades: number[]) => void;
}) {
  function toggleGrade(grade: number) {
    const nextValues = values.includes(grade) ? values.filter((value) => value !== grade) : [...values, grade];
    onChange(nextValues.sort((first, second) => first - second));
  }

  return (
    <div className="grade-picker">
      <span>{copy.teacherGrades}</span>
      <div>
        {grades.map((grade) => (
          <button className={values.includes(grade) ? "active" : ""} key={grade} onClick={() => toggleGrade(grade)} type="button">
            {grade}
          </button>
        ))}
      </div>
      <small>{copy.teacherGradesHelp}</small>
    </div>
  );
}
